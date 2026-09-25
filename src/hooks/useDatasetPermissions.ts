"use client";

/**
 * Dataset permissions — one operation owner for one scope.
 *
 * This hook owns the lifecycle of deliberate role changes and nothing else.
 * Decoding belongs to `lib/datasetPermissions/{decode,groups}.ts`, contract
 * decisions to its `model.ts`, transport to its `gateway.ts` and recovery
 * storage to its `journal.ts`. What is added here is the part none of them can
 * be responsible for: what may be dispatched, exactly once, and which results
 * are still allowed to reach the screen.
 *
 * Operations and storage are *injected*, so the hook has no dependency on
 * `useApi`, auth or the network. `DatasetPermissionsGateway` satisfies
 * {@link DatasetRoleOperations} structurally; wiring the real transport is
 * task 3.2.
 *
 * Scope is `{ principalId, gatewayOrigin, datasetId }` — supplied, not derived.
 * The hook never decodes a bearer token, never uses token text as an identity
 * and never infers a principal from a display name. A same-user token refresh
 * hands it a *new operations object*; that is explicitly not a scope change, so
 * it neither clears state nor invalidates a request in flight.
 *
 * Deliberately absent, each for a reason the design gives:
 *
 *  - **no reads.** Capability evidence is an input the caller supplies. The
 *    read side lives in the adapter and its binding is task 3.2;
 *  - **no retry, rollback or compensation.** An uncertain write is not undone
 *    by sending its inverse, and this hook will not let one be sent;
 *  - **no "clear unknown" control.** Dismissing a warning is not
 *    reconciliation. An uncertain operation is resolved by a supported
 *    authoritative read or an operator, neither of which exists in this slice;
 *  - **no timers.** Nothing here expires, ages out or becomes safe by waiting.
 *
 * Two rules govern what may be dispatched, and both are enforced before the
 * first await rather than by what the screen happens to be showing:
 *
 *  - **an action handle belongs to the owner lifetime that produced it.** The
 *    returned `canAttempt` and `requestRoleChange` are ordinary values a caller
 *    may keep. A handle kept across a change of principal, Gateway, dataset or
 *    mount refuses, before reading the current owner's capabilities, writing
 *    its journal or reaching the transport — from the moment the replacement
 *    renders, not merely from the moment its effect runs, so a layout effect or
 *    ref callback firing in between cannot slip a write through the owner that
 *    has just been replaced. Re-entering a textually identical
 *    scope starts a *new* lifetime, so A → unavailable → A does not revive A's
 *    first handles. Within one lifetime a handle stays usable and is judged
 *    against current authority, so a token refresh changes nothing and a
 *    capability lost since the handle was taken refuses;
 *  - **one write at a time for the active dataset**, per design section 3. The
 *    slot is taken synchronously before dispatch, so two *different*
 *    assignments submitted in the same tick cannot both reach the transport.
 *    It is separate from the per-assignment block below: an uncertain outcome
 *    keeps its own assignment blocked forever, but must not prohibit unrelated
 *    future changes once it has settled.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignmentKey,
  clearSettled,
  type JournalEntry,
  markUncertain,
  type OperationScope,
  type OperationStorageLike,
  readJournal,
  recordUnresolved,
} from "@/lib/datasetPermissions/journal";
import { mayAttempt } from "@/lib/datasetPermissions/model";
import type {
  CapabilityDecision,
  DatasetRoleAction,
  DatasetRoleOperation,
  DatasetRoleOutcome,
  UncertainOutcomeReason,
} from "@/lib/datasetPermissions/types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Structurally a superset of `OperationScope` in `journal.ts`, so the same
 * object can be handed to both without either module depending on the other.
 */
export interface DatasetPermissionsScope extends OperationScope {
  readonly datasetId: string;
}

/** The mutation half of `DatasetPermissionsGateway`. Reads are not reachable. */
export interface DatasetRoleOperations {
  assignRole(
    operation: DatasetRoleOperation,
    signal?: AbortSignal,
  ): Promise<DatasetRoleOutcome>;
  removeRole(
    operation: DatasetRoleOperation,
    signal?: AbortSignal,
  ): Promise<DatasetRoleOutcome>;
}

/**
 * What the caller has established about its own authority, per action.
 *
 * Supplied as evidence rather than computed here: `decideAction` in the model
 * owns that rule, and duplicating it would give the feature two answers. An
 * omitted decision is `unknown`, which never enables anything.
 */
export interface DatasetActionCapabilities {
  readonly grant?: CapabilityDecision;
  readonly revoke?: CapabilityDecision;
}

export interface UseDatasetPermissionsInput {
  /** `null` while identity or dataset is unresolved. Nothing may be sent. */
  readonly scope: DatasetPermissionsScope | null;
  readonly operations: DatasetRoleOperations;
  /**
   * `null` means no usable storage. Because an intent must be recorded before
   * dispatch, that is a hard stop for every mutation, not a degraded mode.
   */
  readonly storage: OperationStorageLike | null;
  readonly capabilities?: DatasetActionCapabilities;
  /** Injected for deterministic tests. Defaults to a per-tab unique value. */
  readonly createOperationId?: () => string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type OperationStatus =
  | "pending"
  | "acknowledged"
  | "refused"
  | "uncertain";

export interface DatasetRoleOperationState {
  readonly operationId: string;
  readonly groupId: string;
  readonly role: string;
  readonly action: DatasetRoleAction;
  readonly status: OperationStatus;
  readonly httpStatus?: number;
  readonly uncertainReason?: UncertainOutcomeReason;
  /**
   * `true` when this came back from the journal on mount rather than from an
   * action taken in this session. The distinction is for the view's wording:
   * "this was left unresolved" reads differently from "this just failed", and
   * neither may be shown as resolved.
   */
  readonly restored: boolean;
}

/** Why an action may not be attempted. Each maps to a different explanation. */
export type BlockedReason =
  /** No resolved identity or dataset. */
  | "scope-unresolved"
  /** No usable storage, so the intent could not be recorded before sending. */
  | "storage-unavailable"
  /** The caller's evidence does not positively authorize this action. */
  | "not-permitted"
  /** A request for this exact assignment is in flight. */
  | "in-flight"
  /**
   * An earlier write on this exact assignment has an unknown outcome. It
   * blocks repeating the action *and* sending its inverse.
   */
  | "uncertain-outcome";

export type AttemptDecision =
  | { readonly kind: "allowed" }
  | { readonly kind: "blocked"; readonly reason: BlockedReason };

export interface DatasetPermissionsController {
  /** Whether any mutation could be attempted at all in the current state. */
  readonly ready: boolean;
  readonly storageAvailable: boolean;
  /** Everything this mount knows about, newest last. */
  readonly operations: readonly DatasetRoleOperationState[];
  /** The subset whose outcome is unknown, restored ones included. */
  readonly uncertain: readonly DatasetRoleOperationState[];
  /** Ask before rendering a control; the handlers check again themselves. */
  readonly canAttempt: (
    groupId: string,
    role: string,
    action: DatasetRoleAction,
  ) => AttemptDecision;
  /**
   * Request one role change. Returns the decision that was actually acted on,
   * so a caller need not re-derive it — a blocked call sends nothing.
   */
  readonly requestRoleChange: (
    groupId: string,
    role: string,
    action: DatasetRoleAction,
  ) => AttemptDecision;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface ControllerState {
  /** What this state belongs to. State from another scope is never rendered. */
  readonly scopeKey: string;
  readonly operations: readonly DatasetRoleOperationState[];
  readonly storageAvailable: boolean;
}

const INACTIVE_SCOPE = "\u0000inactive";

/** NUL-separated so no component value can forge another scope's key. */
const scopeKeyOf = (scope: DatasetPermissionsScope | null): string => {
  if (scope === null) return INACTIVE_SCOPE;
  const { principalId, gatewayOrigin, datasetId } = scope;
  if (
    principalId.trim() === "" ||
    gatewayOrigin.trim() === "" ||
    datasetId.trim() === ""
  ) {
    return INACTIVE_SCOPE;
  }
  return `${principalId}\u0000${gatewayOrigin}\u0000${datasetId}`;
};

const emptyState = (scopeKey: string): ControllerState => ({
  scopeKey,
  operations: [],
  storageAvailable: false,
});

let fallbackOperationSequence = 0;

const defaultOperationId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  fallbackOperationSequence += 1;
  return `op-${fallbackOperationSequence}`;
};

/**
 * A restored entry is always uncertain, whichever marker it carried.
 *
 * An `unresolved` entry means the tab went away while a write was in flight.
 * Nothing about reappearing tells us what the server did with it, so it must
 * come back as uncertain — never as pending, which would imply something is
 * still being awaited, and never as absent.
 */
const restoredOperation = (entry: JournalEntry): DatasetRoleOperationState => ({
  operationId: entry.operationId,
  groupId: entry.groupId,
  role: entry.role,
  action: entry.action,
  status: "uncertain",
  restored: true,
});

const isUncertain = (operation: DatasetRoleOperationState): boolean =>
  operation.status === "uncertain";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDatasetPermissions = ({
  scope,
  operations,
  storage,
  capabilities,
  createOperationId,
}: UseDatasetPermissionsInput): DatasetPermissionsController => {
  const scopeKey = scopeKeyOf(scope);
  const active = scopeKey !== INACTIVE_SCOPE;

  // Scope components travel as primitives so that a caller re-creating the
  // scope object every render does not look like a change of identity.
  const principalId = scope?.principalId ?? null;
  const gatewayOrigin = scope?.gatewayOrigin ?? null;
  const datasetId = scope?.datasetId ?? null;

  const [state, setState] = useState<ControllerState>(() =>
    emptyState(scopeKey),
  );

  // Clear on the render that changes scope, not in a later effect. An effect
  // would paint one frame of the previous principal's operations first, which
  // is exactly what "no previous owner's state is displayed as current"
  // forbids. React re-renders with this value before committing.
  let current = state;
  if (state.scopeKey !== scopeKey) {
    current = emptyState(scopeKey);
    setState(current);
  }

  // The owner lifetime this render belongs to. Counted here rather than from
  // the effect's generation because a callback created during render must know
  // its lifetime before any effect has run — and counted against the previously
  // *rendered* scope key, so the increment happens exactly once per change even
  // when React renders twice and discards the first.
  const lifetimeRef = useRef(0);
  const renderedScopeKeyRef = useRef<string | null>(null);
  if (renderedScopeKeyRef.current !== scopeKey) {
    renderedScopeKeyRef.current = scopeKey;
    lifetimeRef.current += 1;
  }
  const lifetime = lifetimeRef.current;

  /**
   * The lifetime currently mounted and resolved, or `null` when there is none.
   *
   * Set by the effect and cleared by its teardown, so it is the one value that
   * distinguishes "this handle's owner is still here" from "its owner has been
   * replaced, or the component is gone". A repeated scope key gets a new number,
   * which is what an identical-looking A → unavailable → A needs.
   *
   * It lags `lifetimeRef` by one commit, which is why the guard consults both:
   * this one knows about unmounting, and `lifetimeRef` knows about a
   * replacement the moment it renders rather than when its effect runs.
   */
  const activeLifetimeRef = useRef<number | null>(null);

  // Latest-value refs for inputs that must *not* invalidate anything: a
  // refreshed token produces a new operations object for the same principal,
  // and capabilities are re-derived by the caller on every read.
  const operationsRef = useRef(operations);
  const storageRef = useRef(storage);
  const createOperationIdRef = useRef(createOperationId);
  useEffect(() => {
    operationsRef.current = operations;
    storageRef.current = storage;
    createOperationIdRef.current = createOperationId;
  });

  /**
   * Capabilities are the one input read during render rather than after it.
   *
   * A retained handle has to be judged against the authority the caller holds
   * *now*, not the authority of the render that produced it, so this cannot be
   * a closed-over prop. It cannot be an effect-assigned ref either: a
   * `canAttempt` called during the same render that lost a capability would
   * then still answer from the previous one. The value is derived purely from
   * props and overwritten by every later render, so a render React discards
   * cannot leave a stale one behind.
   */
  const capabilitiesRef = useRef(capabilities);
  capabilitiesRef.current = capabilities;

  /**
   * The synchronous guard.
   *
   * State is not usable for this: two clicks in one tick would both read the
   * same pre-update snapshot. A ref mutated inside the handler is the only
   * thing that can refuse the second click before the first has rendered.
   *
   * Keyed by assignment, not by action, so an in-flight or uncertain grant
   * also blocks the matching revoke.
   */
  const blockedRef = useRef<Set<string>>(new Set());

  /**
   * Incremented on every effect start *and* teardown, so a promise that
   * resolves late is rejected even by a transport that ignored its signal.
   * The teardown increment is what makes A → unavailable → A safe: the second
   * A is a different generation from the first, although its scope key is
   * identical.
   */
  const generationRef = useRef(0);
  const scopeRef = useRef<OperationScope | null>(null);

  /**
   * The one write in flight for this dataset, by operation id, or `null`.
   *
   * Design section 3 prevents a *second dataset action* while one is pending,
   * which `blockedRef` cannot express: it is keyed by assignment, so two
   * different assignments submitted before the first render both passed. The
   * slot holds an id rather than a boolean so that only the operation that took
   * it can give it back — a completion belonging to a replaced owner returns
   * earlier on the generation check, and could not free a successor's slot even
   * if it did not.
   */
  const pendingWriteRef = useRef<string | null>(null);

  useEffect(() => {
    generationRef.current += 1;
    blockedRef.current = new Set();
    // A new owner never inherits the previous one's write slot. The previous
    // write is deliberately not aborted, but it belongs to an owner that is
    // gone, and its completion is dropped on the generation check.
    pendingWriteRef.current = null;
    activeLifetimeRef.current = null;

    if (
      principalId === null ||
      gatewayOrigin === null ||
      datasetId === null ||
      principalId.trim() === "" ||
      gatewayOrigin.trim() === "" ||
      datasetId.trim() === ""
    ) {
      scopeRef.current = null;
      return () => {
        generationRef.current += 1;
      };
    }

    const operationScope: OperationScope = { principalId, gatewayOrigin };
    scopeRef.current = operationScope;
    // From here the handles produced by this lifetime's renders are live, and
    // every earlier lifetime's handles are not.
    activeLifetimeRef.current = lifetimeRef.current;

    // Restore, on the render after mount, whatever this scope left unresolved.
    // Nothing is dispatched here and nothing can be: the journal holds
    // identifiers, and this module has no path from an entry back to a write.
    const restored = readJournal(storageRef.current, operationScope);
    if (restored.kind === "read") {
      const mine = restored.entries.filter(
        (entry) => entry.datasetId === datasetId,
      );
      for (const entry of mine) {
        blockedRef.current.add(assignmentKey(entry));
      }
      const restoredIds = new Set(mine.map((entry) => entry.operationId));
      setState((previous) =>
        previous.scopeKey === scopeKey
          ? {
              ...previous,
              storageAvailable: true,
              // Replacing rather than appending keeps this idempotent: React
              // re-runs effects in development, and an outstanding operation
              // must appear once, not once per run.
              operations: [
                ...mine.map(restoredOperation),
                ...previous.operations.filter(
                  (operation) => !restoredIds.has(operation.operationId),
                ),
              ],
            }
          : previous,
      );
    } else {
      // Unavailable *or* unreadable. Both mean an intent cannot be recorded,
      // and a write that cannot be recorded is not sent.
      setState((previous) =>
        previous.scopeKey === scopeKey
          ? { ...previous, storageAvailable: false }
          : previous,
      );
    }

    return () => {
      // A request already in flight is deliberately *not* aborted. Aborting
      // would not undo it, and the design is explicit that a client abort
      // implies nothing about the server; all it would add is a guarantee that
      // we never learn the outcome. The generation bump is enough: the
      // completion is ignored, and its journal entry stays unresolved, so the
      // next mount restores it as uncertain.
      generationRef.current += 1;
      scopeRef.current = null;
      activeLifetimeRef.current = null;
      pendingWriteRef.current = null;
    };
    // `storage` is read through its ref: replacing the storage object is not a
    // scope change, and re-running this effect would re-add restored entries.
  }, [scopeKey, principalId, gatewayOrigin, datasetId]);

  const renderedOperations = current.operations;
  const storageAvailable = current.storageAvailable;

  const decideAttempt = useCallback(
    (
      groupId: string,
      role: string,
      action: DatasetRoleAction,
    ): AttemptDecision => {
      // First, before anything current-owner is read: does this handle's owner
      // still exist? A handle from a replaced principal, Gateway or dataset, or
      // from a mount that is gone, stops here. `scope-unresolved` is the honest
      // existing reason — from this handle's point of view its scope is no
      // longer resolved — and reusing it keeps the reason set, and every
      // consumer's wording for it, unchanged.
      //
      // Both sides of the lifetime are checked, because a replacement becomes
      // visible to each at a different moment. `lifetimeRef` advances during
      // the replacement *render*; `activeLifetimeRef` only in the passive
      // effect that follows its commit. Between the two — a layout effect, a
      // ref callback, anything synchronous a committed child runs — the mounted
      // owner is still the previous one, so that check alone would let an
      // obsolete handle through to the previous scope's transport and journal.
      // The rendered side closes that window; the mounted side is what still
      // refuses after an unmount, when no render follows at all.
      if (
        lifetimeRef.current !== lifetime ||
        activeLifetimeRef.current !== lifetime
      ) {
        return { kind: "blocked", reason: "scope-unresolved" };
      }

      const activeScope = scopeRef.current;
      if (activeScope === null || datasetId === null) {
        return { kind: "blocked", reason: "scope-unresolved" };
      }
      if (!storageAvailable || storageRef.current === null) {
        return { kind: "blocked", reason: "storage-unavailable" };
      }

      // Current authority, not the authority of the render that produced this
      // handle: a capability lost since then must refuse.
      const currentCapabilities = capabilitiesRef.current;
      const decision =
        action === "assign"
          ? currentCapabilities?.grant
          : currentCapabilities?.revoke;
      if (!mayAttempt(decision ?? "unknown")) {
        return { kind: "blocked", reason: "not-permitted" };
      }

      if (blockedRef.current.has(assignmentKey({ datasetId, groupId, role }))) {
        // The guard cannot tell the two apart on its own, so the reason comes
        // from what is on screen. Both refuse; only the wording differs.
        const uncertainHere = renderedOperations.some(
          (operation) =>
            isUncertain(operation) &&
            operation.groupId === groupId &&
            operation.role === role,
        );
        return {
          kind: "blocked",
          reason: uncertainHere ? "uncertain-outcome" : "in-flight",
        };
      }

      // One write at a time for this dataset. Checked last, so an assignment
      // that is itself in flight or uncertain still reports its own reason.
      if (pendingWriteRef.current !== null) {
        return { kind: "blocked", reason: "in-flight" };
      }

      return { kind: "allowed" };
    },
    [datasetId, storageAvailable, renderedOperations, lifetime],
  );

  const canAttempt = decideAttempt;

  const requestRoleChange = useCallback(
    (
      groupId: string,
      role: string,
      action: DatasetRoleAction,
    ): AttemptDecision => {
      const decision = decideAttempt(groupId, role, action);
      if (decision.kind === "blocked") return decision;

      const activeScope = scopeRef.current;
      const activeStorage = storageRef.current;
      if (
        lifetimeRef.current !== lifetime ||
        activeLifetimeRef.current !== lifetime ||
        activeScope === null ||
        activeStorage === null ||
        datasetId === null
      ) {
        return { kind: "blocked", reason: "scope-unresolved" };
      }

      // Frozen before anything is awaited. A later render, a refreshed token or
      // a changed selection cannot alter what this request is about.
      const frozen: DatasetRoleOperation = Object.freeze({
        operationId: (createOperationIdRef.current ?? defaultOperationId)(),
        datasetId,
        groupId,
        role,
        action,
      });
      const key = assignmentKey(frozen);

      // Both guards are acquired synchronously, before the first await and
      // before any state update, so a second submission in the same tick is
      // already refused: the assignment key refuses a repeat or inverse of
      // *this* change, and the dataset slot refuses any other change.
      blockedRef.current.add(key);
      pendingWriteRef.current = frozen.operationId;

      // Record the intent *before* dispatch. If it cannot be stored, nothing
      // is sent: a lost response with no record would leave the next mount
      // inviting a repeat of a write that may already have happened.
      const recorded = recordUnresolved(activeStorage, activeScope, frozen);
      if (recorded.kind !== "stored") {
        // Refused before dispatch: give both guards back, or this dataset
        // would stay locked against a write that never went out.
        blockedRef.current.delete(key);
        if (pendingWriteRef.current === frozen.operationId) {
          pendingWriteRef.current = null;
        }
        setState((previous) =>
          previous.scopeKey === scopeKey
            ? { ...previous, storageAvailable: false }
            : previous,
        );
        return { kind: "blocked", reason: "storage-unavailable" };
      }

      const generation = generationRef.current;

      setState((previous) =>
        previous.scopeKey === scopeKey
          ? {
              ...previous,
              operations: [
                ...previous.operations,
                {
                  operationId: frozen.operationId,
                  groupId,
                  role,
                  action,
                  status: "pending" as const,
                  restored: false,
                },
              ],
            }
          : previous,
      );

      void (async () => {
        const send =
          action === "assign"
            ? operationsRef.current.assignRole
            : operationsRef.current.removeRole;

        let outcome: DatasetRoleOutcome;
        try {
          outcome = await send(frozen);
        } catch {
          // A transport that throws tells us nothing about the server.
          outcome = { kind: "uncertain", reason: "no-response" };
        }

        // Ownership check. A completion from a previous owner — including the
        // previous occupant of an identical scope key — updates nothing and
        // dispatches nothing.
        if (generationRef.current !== generation) return;

        // Settled, whichever way: this dataset may be written to again. Only
        // the operation holding the slot can release it, so a completion that
        // somehow outlived its owner cannot unlock a successor's.
        if (pendingWriteRef.current === frozen.operationId) {
          pendingWriteRef.current = null;
        }

        const settledScope = scopeRef.current;
        const settledStorage = storageRef.current;

        if (outcome.kind === "uncertain") {
          // The assignment stays blocked: repeating it and undoing it are
          // equally uncertain, and neither is offered again.
          if (settledScope !== null) {
            markUncertain(settledStorage, settledScope, frozen.operationId);
          }
        } else {
          blockedRef.current.delete(key);
          if (settledScope !== null) {
            clearSettled(settledStorage, settledScope, frozen.operationId);
          }
        }

        setState((previous) => {
          if (previous.scopeKey !== scopeKey) return previous;
          return {
            ...previous,
            operations: previous.operations.map((operation) =>
              operation.operationId === frozen.operationId
                ? {
                    ...operation,
                    status:
                      outcome.kind === "acknowledged"
                        ? ("acknowledged" as const)
                        : outcome.kind === "refused"
                          ? ("refused" as const)
                          : ("uncertain" as const),
                    ...(outcome.kind === "uncertain"
                      ? {
                          uncertainReason: outcome.reason,
                          ...(outcome.httpStatus === undefined
                            ? {}
                            : { httpStatus: outcome.httpStatus }),
                        }
                      : { httpStatus: outcome.httpStatus }),
                  }
                : operation,
            ),
          };
        });
      })();

      return { kind: "allowed" };
    },
    [decideAttempt, datasetId, scopeKey, lifetime],
  );

  const uncertain = useMemo(
    () => renderedOperations.filter(isUncertain),
    [renderedOperations],
  );

  return {
    ready: active && storageAvailable,
    storageAvailable,
    operations: renderedOperations,
    uncertain,
    canAttempt,
    requestRoleChange,
  };
};
