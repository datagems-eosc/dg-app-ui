/**
 * Dataset permissions — the operation journal.
 *
 * One job: remember, across a close, a reopen and a page refresh within the
 * tab, that a write was issued and its result is not known. That is the only
 * thing standing between a lost response and a user who clicks again because
 * the screen came back looking untouched.
 *
 * What an entry contains: dataset id, group id, role identifier, action,
 * outcome marker and a timestamp. What it must never contain: tokens, names,
 * descriptions, response bodies or anything else that would turn a recovery
 * marker into a cache of someone's data.
 *
 * Deliberately absent, and not an oversight:
 *
 *  - no mutation surface. This module imports types and touches storage; there
 *    is no operation to invoke even by mistake, so a restored entry can never
 *    replay the write it describes;
 *  - no expiry and no "stale" rule. An unresolved operation does not become
 *    safe because time passed — the server either applied it or did not, and a
 *    clock knows nothing about which;
 *  - no cross-tab or cross-device history. `sessionStorage` is per tab, which
 *    is the agreed recovery scope;
 *  - no migration. An unrecognised version is refused, not upgraded.
 *
 * Scope isolation is by `(principalId, gatewayOrigin)`. Another account's
 * entries are never returned and never acted on, but they are also never
 * erased: the original account may come back to the same tab and is entitled
 * to its own uncertainty.
 */

import type { DatasetRoleAction } from "./types";

/** Bumped whenever the stored shape changes. Unknown versions are refused. */
export const OPERATION_JOURNAL_VERSION = 1;

/** One key for the whole journal, across scopes and datasets. */
export const OPERATION_JOURNAL_KEY = "datagems.datasetPermissions.operations";

/**
 * The narrow slice of `Storage` this module uses. Injecting it keeps the
 * module testable without a DOM and makes "storage is unavailable" a
 * first-class case rather than an exception escaping into a render.
 */
export interface OperationStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Identity and environment an entry belongs to. */
export interface OperationScope {
  readonly principalId: string;
  readonly gatewayOrigin: string;
}

/**
 * How far an operation got.
 *
 * `unresolved` is written *before* dispatch and means "issued, no answer yet".
 * `uncertain` is written when an answer arrived that settled nothing. On a
 * fresh mount the two are indistinguishable in their consequences — both mean
 * the write may or may not have been applied — and both are restored as
 * uncertain. The marker is kept apart only so an operator reading storage can
 * tell a process that was interrupted from one that got an inconclusive reply.
 */
export type JournalOutcome = "unresolved" | "uncertain";

export interface JournalEntry {
  readonly operationId: string;
  readonly principalId: string;
  readonly gatewayOrigin: string;
  readonly datasetId: string;
  readonly groupId: string;
  readonly role: string;
  readonly action: DatasetRoleAction;
  readonly outcome: JournalOutcome;
  /** ISO-8601, for operator diagnosis only. Nothing branches on it. */
  readonly recordedAt: string;
}

export type JournalRejection =
  | "unparsable"
  | "not-an-object"
  | "unknown-version"
  | "invalid-field";

export type JournalReadOutcome =
  /** Entries for the requested scope. An empty list is a real answer. */
  | { readonly kind: "read"; readonly entries: readonly JournalEntry[] }
  /**
   * Present but unusable. The stored document is left alone rather than
   * cleared: removing it would destroy evidence we already could not read.
   */
  | { readonly kind: "discarded"; readonly reason: JournalRejection }
  /** Storage is missing, blocked or throwing. */
  | { readonly kind: "unavailable" };

export type JournalWriteOutcome =
  | { readonly kind: "stored" }
  /** Nothing was written. A caller about to dispatch must not dispatch. */
  | { readonly kind: "unavailable" };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value) && Number.isFinite(Date.parse(value));

const isAction = (value: unknown): value is DatasetRoleAction =>
  value === "assign" || value === "remove";

const isOutcome = (value: unknown): value is JournalOutcome =>
  value === "unresolved" || value === "uncertain";

export const isUsableScope = (
  scope: OperationScope | null | undefined,
): scope is OperationScope =>
  scope !== null &&
  scope !== undefined &&
  isNonEmptyString(scope.principalId) &&
  isNonEmptyString(scope.gatewayOrigin);

/**
 * The key a duplicate guard and the blocked-inverse rule both use.
 *
 * Deliberately **not** keyed by action: an uncertain grant blocks the matching
 * revoke as well, because undoing a write whose result is unknown is as
 * uncertain as repeating it.
 */
export const assignmentKey = (assignment: {
  readonly datasetId: string;
  readonly groupId: string;
  readonly role: string;
}): string =>
  `${assignment.datasetId}\u0000${assignment.groupId}\u0000${assignment.role}`;

/**
 * Rebuilds each entry field by field. Anything else the payload carries is
 * dropped here rather than flowing onwards, so a record written by a future
 * version — or tampered with — cannot smuggle a field into the application.
 * One invalid entry invalidates the document: a partially readable journal
 * would understate what is outstanding, which is the direction that matters.
 */
const parseDocument = (
  raw: string,
):
  | { ok: true; entries: JournalEntry[] }
  | { ok: false; reason: JournalRejection } => {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unparsable" };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return { ok: false, reason: "not-an-object" };
  }

  const document = payload as Record<string, unknown>;
  if (document.version !== OPERATION_JOURNAL_VERSION) {
    return { ok: false, reason: "unknown-version" };
  }
  if (!Array.isArray(document.entries)) {
    return { ok: false, reason: "invalid-field" };
  }

  const entries: JournalEntry[] = [];
  for (const candidate of document.entries) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return { ok: false, reason: "invalid-field" };
    }
    const entry = candidate as Record<string, unknown>;
    if (
      !isNonEmptyString(entry.operationId) ||
      !isNonEmptyString(entry.principalId) ||
      !isNonEmptyString(entry.gatewayOrigin) ||
      !isNonEmptyString(entry.datasetId) ||
      !isNonEmptyString(entry.groupId) ||
      !isNonEmptyString(entry.role) ||
      !isAction(entry.action) ||
      !isOutcome(entry.outcome) ||
      !isValidTimestamp(entry.recordedAt)
    ) {
      return { ok: false, reason: "invalid-field" };
    }
    entries.push({
      operationId: entry.operationId,
      principalId: entry.principalId,
      gatewayOrigin: entry.gatewayOrigin,
      datasetId: entry.datasetId,
      groupId: entry.groupId,
      role: entry.role,
      action: entry.action,
      outcome: entry.outcome,
      recordedAt: entry.recordedAt,
    });
  }

  return { ok: true, entries };
};

const loadAll = (
  storage: OperationStorageLike,
):
  | { ok: true; entries: JournalEntry[] }
  | { ok: false; outcome: JournalReadOutcome } => {
  let raw: string | null;
  try {
    raw = storage.getItem(OPERATION_JOURNAL_KEY);
  } catch {
    return { ok: false, outcome: { kind: "unavailable" } };
  }
  if (raw === null) return { ok: true, entries: [] };

  const parsed = parseDocument(raw);
  if (!parsed.ok) {
    return { ok: false, outcome: { kind: "discarded", reason: parsed.reason } };
  }
  return { ok: true, entries: parsed.entries };
};

const belongsTo = (entry: JournalEntry, scope: OperationScope): boolean =>
  entry.principalId === scope.principalId &&
  entry.gatewayOrigin === scope.gatewayOrigin;

/**
 * Read the outstanding entries for one scope.
 *
 * Entries belonging to other principals or environments are filtered out and
 * left in storage untouched.
 */
export function readJournal(
  storage: OperationStorageLike | null,
  scope: OperationScope | null,
): JournalReadOutcome {
  if (storage === null || !isUsableScope(scope)) return { kind: "unavailable" };

  const loaded = loadAll(storage);
  if (!loaded.ok) return loaded.outcome;

  return {
    kind: "read",
    entries: loaded.entries.filter((entry) => belongsTo(entry, scope)),
  };
}

/**
 * Persist the whole document, keeping other scopes' entries verbatim.
 *
 * A failure is reported, never swallowed: the one caller that matters is about
 * to dispatch a write and must not do so if its intent could not be recorded.
 */
const persist = (
  storage: OperationStorageLike,
  entries: readonly JournalEntry[],
): JournalWriteOutcome => {
  try {
    if (entries.length === 0) {
      storage.removeItem(OPERATION_JOURNAL_KEY);
      return { kind: "stored" };
    }
    storage.setItem(
      OPERATION_JOURNAL_KEY,
      JSON.stringify({ version: OPERATION_JOURNAL_VERSION, entries }),
    );
    return { kind: "stored" };
  } catch {
    return { kind: "unavailable" };
  }
};

export interface RecordIntentInput {
  readonly operationId: string;
  readonly datasetId: string;
  readonly groupId: string;
  readonly role: string;
  readonly action: DatasetRoleAction;
  /** Defaults to now. Injected by tests so they need no clock control. */
  readonly recordedAt?: string;
}

/**
 * Record an operation as unresolved **before** it is sent.
 *
 * The caller must treat `unavailable` as a stop: with no record, a lost
 * response would leave no trace at all and the next mount would show a screen
 * that invites the user to repeat a write that may already have happened.
 *
 * A journal that cannot be parsed is also a stop. Rewriting it would discard
 * whatever unresolved operations it held, which is the one thing worse than
 * failing to add one.
 */
export function recordUnresolved(
  storage: OperationStorageLike | null,
  scope: OperationScope | null,
  input: RecordIntentInput,
): JournalWriteOutcome {
  if (storage === null || !isUsableScope(scope)) return { kind: "unavailable" };

  const loaded = loadAll(storage);
  if (!loaded.ok) return { kind: "unavailable" };

  const entry: JournalEntry = {
    operationId: input.operationId,
    principalId: scope.principalId,
    gatewayOrigin: scope.gatewayOrigin,
    datasetId: input.datasetId,
    groupId: input.groupId,
    role: input.role,
    action: input.action,
    outcome: "unresolved",
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };

  return persist(storage, [
    ...loaded.entries.filter(
      (existing) => existing.operationId !== entry.operationId,
    ),
    entry,
  ]);
}

/**
 * Promote an entry to `uncertain` once an inconclusive answer arrives.
 *
 * Failing to write this is survivable in a way that failing to write the
 * intent is not: the entry is already there as `unresolved`, and both restore
 * as uncertain.
 */
export function markUncertain(
  storage: OperationStorageLike | null,
  scope: OperationScope | null,
  operationId: string,
): JournalWriteOutcome {
  if (storage === null || !isUsableScope(scope)) return { kind: "unavailable" };

  const loaded = loadAll(storage);
  if (!loaded.ok) return { kind: "unavailable" };

  return persist(
    storage,
    loaded.entries.map((entry) =>
      entry.operationId === operationId && belongsTo(entry, scope)
        ? { ...entry, outcome: "uncertain" as const }
        : entry,
    ),
  );
}

/**
 * Remove an entry whose outcome is settled — acknowledged or definitely
 * refused. There is nothing outstanding to recover, so nothing to keep.
 *
 * This is the *only* removal path, and it is reachable only from a settled
 * outcome. There is deliberately no function that clears an uncertain entry:
 * "I dismissed the warning" is not reconciliation, and offering it as one
 * would turn an unknown write into a safe-looking screen.
 */
export function clearSettled(
  storage: OperationStorageLike | null,
  scope: OperationScope | null,
  operationId: string,
): JournalWriteOutcome {
  if (storage === null || !isUsableScope(scope)) return { kind: "unavailable" };

  const loaded = loadAll(storage);
  if (!loaded.ok) return { kind: "unavailable" };

  return persist(
    storage,
    loaded.entries.filter(
      (entry) =>
        !(entry.operationId === operationId && belongsTo(entry, scope)),
    ),
  );
}
