/**
 * Dataset onboarding — minimal same-tab session reference.
 *
 * This module owns exactly one thing: a versioned pointer saying "this
 * principal, in this environment, started process X, and its sharing intent
 * still needs reconciliation". It is a *reference*, not a cache and not a
 * record of what happened.
 *
 * Deliberately absent, and not an oversight:
 *
 *  - no snapshots, dataset titles, file data, selected groups or tokens;
 *  - no mutation surface at all — nothing here can start ingestion, apply a
 *    grant or replay one. It imports types only; there is no operation to
 *    invoke even by mistake;
 *  - no cross-tab or cross-device history. `sessionStorage` is per tab, which
 *    is the agreed recovery scope;
 *  - no expiry policy. A record is valid or it is not; inventing a lifetime
 *    would be a product decision this slice has not been given.
 *
 * A restored record is a *hint to read again through the Gateway*. It carries
 * no authority: Gateway still decides what this principal may see.
 */

import { asProcessInstanceId, type ProcessInstanceId } from "./types";

/**
 * Bumped whenever the stored shape changes. An unrecognised version is
 * discarded rather than migrated — the record is cheap to lose and a wrong
 * migration is not.
 */
export const SESSION_RECORD_VERSION = 1;

/** One key, one record. A second attempt in the same tab replaces the first. */
export const SESSION_RECORD_KEY = "datagems.datasetOnboarding.session";

/**
 * The narrow slice of the `Storage` interface this module uses. Injecting it
 * keeps the module testable without a DOM and makes "storage is unavailable" a
 * first-class case instead of an exception escaping into a render.
 */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Identity and environment a record belongs to. Structurally identical to the
 * hook's `OnboardingProcessIdentity` so a route can pass one object to both,
 * without either module depending on the other.
 *
 * `principalId` is the application's stable authenticated principal
 * identifier. It is never an email and never access-token text: a token is
 * re-issued on refresh, so using it would invalidate a live session's own
 * record. Establishing the concrete source is task 4.3.
 */
export interface OnboardingSessionScope {
  readonly principalId: string;
  readonly gatewayOrigin: string;
}

export interface OnboardingSessionRecord {
  readonly version: typeof SESSION_RECORD_VERSION;
  readonly processInstanceId: ProcessInstanceId;
  readonly principalId: string;
  readonly gatewayOrigin: string;
  /** ISO-8601, for operator diagnosis only. Nothing branches on it. */
  readonly recordedAt: string;
  /**
   * `true` means sharing *was* requested somewhere and was not confirmed when
   * this reference was written, so a recovered session must re-establish
   * effective access before claiming anything. It can never authorise
   * replaying a grant.
   *
   * `false` is written by the private onboarding flow (revision 5), which
   * requests no sharing at all: there is nothing outstanding to reconcile.
   * It is the absence of a task, never evidence that sharing succeeded, that
   * the dataset is private or public, or that anyone can read it. The schema
   * and the parsing below are unchanged — only the flow's marker value is new,
   * so an older record written with `true` keeps its warning verbatim and is
   * never rewritten.
   */
  readonly sharingNeedsReconciliation: boolean;
}

export type SessionRecordRejection =
  | "unparsable"
  | "not-an-object"
  | "unknown-version"
  | "invalid-field";

export type SessionReadOutcome =
  | { readonly kind: "restored"; readonly record: OnboardingSessionRecord }
  /** Nothing stored, or no usable identity to match against. */
  | { readonly kind: "absent" }
  /**
   * Present but unusable, so it is refused: never parsed into a record and
   * never returned. Removal from storage is attempted on a best-effort basis
   * and its failure is deliberately swallowed — a store that refuses writes
   * still yields `discarded`, because the refusal is what protects the caller.
   * This outcome therefore asserts *logical* discard, not that the underlying
   * entry is gone.
   */
  | { readonly kind: "discarded"; readonly reason: SessionRecordRejection }
  /** Structurally valid, but another principal's or environment's. Kept, never returned. */
  | { readonly kind: "foreign"; readonly reason: "principal" | "environment" }
  /** Storage is missing, blocked or throwing. In-memory monitoring is unaffected. */
  | { readonly kind: "unavailable" };

export type SessionWriteOutcome =
  | { readonly kind: "stored"; readonly record: OnboardingSessionRecord }
  | {
      readonly kind: "skipped";
      readonly reason: "no-identity" | "invalid-reference";
    }
  | { readonly kind: "unavailable" };

export interface SessionRecordInput {
  readonly processInstanceId: ProcessInstanceId;
  readonly scope: OnboardingSessionScope;
  readonly sharingNeedsReconciliation: boolean;
  /** Defaults to now. Injected by tests so they need no clock control. */
  readonly recordedAt?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** A timestamp must be a real instant; an unparsable string is a broken record. */
const isValidTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value) && Number.isFinite(Date.parse(value));

/**
 * An identity is usable only when both halves are present. A blank principal
 * means "not resolved yet", and an unresolved identity neither restores nor
 * writes anything.
 */
export const isUsableScope = (
  scope: OnboardingSessionScope | null | undefined,
): scope is OnboardingSessionScope =>
  scope !== null &&
  scope !== undefined &&
  isNonEmptyString(scope.principalId) &&
  isNonEmptyString(scope.gatewayOrigin);

/**
 * Rebuilds the record field by field from validated values. Anything else the
 * payload happens to carry is dropped here rather than flowing onwards, so a
 * record written by a future version — or tampered with — cannot smuggle an
 * extra field into the application.
 */
const parseRecord = (
  raw: string,
):
  | { ok: true; record: OnboardingSessionRecord }
  | { ok: false; reason: SessionRecordRejection } => {
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

  const candidate = payload as Record<string, unknown>;

  if (candidate.version !== SESSION_RECORD_VERSION) {
    return { ok: false, reason: "unknown-version" };
  }
  if (
    !isNonEmptyString(candidate.processInstanceId) ||
    !isNonEmptyString(candidate.principalId) ||
    !isNonEmptyString(candidate.gatewayOrigin) ||
    !isValidTimestamp(candidate.recordedAt) ||
    typeof candidate.sharingNeedsReconciliation !== "boolean"
  ) {
    return { ok: false, reason: "invalid-field" };
  }

  return {
    ok: true,
    record: {
      version: SESSION_RECORD_VERSION,
      processInstanceId: asProcessInstanceId(candidate.processInstanceId),
      principalId: candidate.principalId,
      gatewayOrigin: candidate.gatewayOrigin,
      recordedAt: candidate.recordedAt,
      sharingNeedsReconciliation: candidate.sharingNeedsReconciliation,
    },
  };
};

// ---------------------------------------------------------------------------
// Storage access
// ---------------------------------------------------------------------------

/**
 * Every storage call is wrapped: Safari private mode, a disabled-cookie
 * profile and a quota-exhausted store all throw on ordinary operations, and
 * none of them is a reason for monitoring to fail.
 */
const safely = <T>(
  operation: () => T,
): { ok: true; value: T } | { ok: false } => {
  try {
    return { ok: true, value: operation() };
  } catch {
    return { ok: false };
  }
};

/**
 * The browser store, or `null` where it cannot be reached — server rendering,
 * or a profile that blocks it. Resolved on call, never at module load, so this
 * file stays importable outside a browser.
 */
export const getBrowserSessionStorage = (): SessionStorageLike | null => {
  const resolved = safely(() =>
    typeof window === "undefined" ? null : window.sessionStorage,
  );
  return resolved.ok ? (resolved.value ?? null) : null;
};

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Reads the stored reference for this scope.
 *
 * Performs no mutation beyond a best-effort removal of a record it has just
 * proven unusable; if that removal fails, the record is still refused.
 * Restoring is not resuming: the caller still has to read the process through
 * the Gateway, which is what enforces access.
 *
 * A record belonging to a different principal or environment is reported as
 * `foreign` and is *not* returned — that is the isolation requirement. It is
 * deliberately left in place rather than deleted: this module cannot tell an
 * account switch from a transient identity change, and silently destroying the
 * other session's reference is the more damaging mistake. Call
 * `clearSessionRecord` on an explicit sign-out.
 */
export const readSessionRecord = (
  storage: SessionStorageLike | null,
  scope: OnboardingSessionScope | null | undefined,
): SessionReadOutcome => {
  if (storage === null) return { kind: "unavailable" };
  // No resolved identity means there is nothing to match against, so nothing
  // may be restored. This is checked before reading, not after.
  if (!isUsableScope(scope)) return { kind: "absent" };

  const raw = safely(() => storage.getItem(SESSION_RECORD_KEY));
  if (!raw.ok) return { kind: "unavailable" };
  if (raw.value === null) return { kind: "absent" };

  const parsed = parseRecord(raw.value);
  if (!parsed.ok) {
    // Corrupt or superseded. The refusal below is unconditional; the removal
    // is a best-effort tidy-up so the entry is not re-examined on every read,
    // and a store that rejects it changes nothing about the refusal.
    safely(() => storage.removeItem(SESSION_RECORD_KEY));
    return { kind: "discarded", reason: parsed.reason };
  }

  if (parsed.record.principalId !== scope.principalId) {
    return { kind: "foreign", reason: "principal" };
  }
  if (parsed.record.gatewayOrigin !== scope.gatewayOrigin) {
    return { kind: "foreign", reason: "environment" };
  }

  return { kind: "restored", record: parsed.record };
};

/**
 * Writes the reference for an accepted or uncertain attempt.
 *
 * Refuses without a resolved identity, because an unattributed record could
 * later be restored by whoever next uses the tab. Storage failure is reported,
 * never thrown: losing the reference costs a refresh, not the process.
 */
export const writeSessionRecord = (
  storage: SessionStorageLike | null,
  input: SessionRecordInput,
): SessionWriteOutcome => {
  if (storage === null) return { kind: "unavailable" };
  if (!isUsableScope(input.scope))
    return { kind: "skipped", reason: "no-identity" };
  if (!isNonEmptyString(input.processInstanceId)) {
    return { kind: "skipped", reason: "invalid-reference" };
  }

  const recordedAt = input.recordedAt ?? new Date().toISOString();
  if (!isValidTimestamp(recordedAt)) {
    return { kind: "skipped", reason: "invalid-reference" };
  }

  // Assembled explicitly. Whatever else the caller passed is not persisted.
  const record: OnboardingSessionRecord = {
    version: SESSION_RECORD_VERSION,
    processInstanceId: input.processInstanceId,
    principalId: input.scope.principalId,
    gatewayOrigin: input.scope.gatewayOrigin,
    recordedAt,
    sharingNeedsReconciliation: input.sharingNeedsReconciliation,
  };

  const written = safely(() =>
    storage.setItem(SESSION_RECORD_KEY, JSON.stringify(record)),
  );
  return written.ok ? { kind: "stored", record } : { kind: "unavailable" };
};

/**
 * Updates only the reconciliation marker of a record belonging to this scope.
 *
 * Clearing the marker records that sharing was *established by an authorized
 * check*; it is a note about a completed observation, never permission to
 * apply a grant. A foreign or unusable record is left for `readSessionRecord`
 * to handle rather than being rewritten under the current identity.
 */
export const setSharingNeedsReconciliation = (
  storage: SessionStorageLike | null,
  scope: OnboardingSessionScope | null | undefined,
  sharingNeedsReconciliation: boolean,
): SessionWriteOutcome => {
  const existing = readSessionRecord(storage, scope);
  if (existing.kind !== "restored") {
    return existing.kind === "unavailable"
      ? { kind: "unavailable" }
      : { kind: "skipped", reason: "invalid-reference" };
  }
  if (
    existing.record.sharingNeedsReconciliation === sharingNeedsReconciliation
  ) {
    return { kind: "stored", record: existing.record };
  }

  return writeSessionRecord(storage, {
    processInstanceId: existing.record.processInstanceId,
    scope: {
      principalId: existing.record.principalId,
      gatewayOrigin: existing.record.gatewayOrigin,
    },
    sharingNeedsReconciliation,
    recordedAt: existing.record.recordedAt,
  });
};

/** Removes the reference unconditionally. Used on explicit sign-out. */
export const clearSessionRecord = (
  storage: SessionStorageLike | null,
): void => {
  if (storage === null) return;
  safely(() => storage.removeItem(SESSION_RECORD_KEY));
};
