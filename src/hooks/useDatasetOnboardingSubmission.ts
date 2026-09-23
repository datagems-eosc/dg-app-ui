"use client";

/**
 * Dataset onboarding — one submission owner for one scope.
 *
 * This hook owns lifecycle and nothing else. Validation, freezing and the
 * transitions belong to the pure `lib/datasetOnboarding/submission.ts`; the
 * outcome classification belongs to the accepted adapter; the stored reference
 * belongs to the accepted `recovery.ts`. What is added here is the part none
 * of them can be responsible for: holding the duplicate-start guard *before*
 * anything is awaited, and deciding which late result is still allowed to
 * reach the screen or the store.
 *
 * The start operation is injected rather than imported, so the hook has no
 * dependency on `useApi`, auth or the network. `OnboardingGateway` satisfies
 * `OnboardingStartOperations` structurally; wiring the real transport, the
 * rollout flags and the form is group 6 integration work that this slice
 * deliberately does not do.
 *
 * Scope is `{ principalId, gatewayOrigin }` — supplied, not derived. The hook
 * never decodes a bearer token, never uses token text as an identity and never
 * infers a principal from a display name. A same-user token refresh hands it a
 * *new operations object*; that is explicitly not a scope change, so it
 * neither restarts a submission nor discards a pending attempt.
 *
 * Deliberately absent, and not an oversight:
 *
 *  - no start from mount, effect, refresh or retry. `submit` is the only path
 *    to the operation, and it is reachable only from an explicit action;
 *  - no storage *read*. The store is written on acceptance and never consulted,
 *    so a stored process id can neither be borrowed by an unknown start nor
 *    drive a resubmission;
 *  - no grant, visibility, collection or role work, and no dataset lookup by
 *    title. An unknown outcome stays unknown.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getBrowserSessionStorage,
  type SessionStorageLike,
  type SessionWriteOutcome,
  writeSessionRecord,
} from "@/lib/datasetOnboarding/recovery";
import {
  applyStagingValidityEvidence,
  beginSubmission,
  discardAttempt,
  initialSubmissionState,
  type ReferenceDisposition,
  referenceDisposition,
  type SharingIntent,
  type StagingValidityEvidence,
  type SubmissionAttempt,
  type SubmissionBlock,
  type SubmissionRequest,
  type SubmissionState,
  type SubmissionStatus,
  settleSubmission,
} from "@/lib/datasetOnboarding/submission";
import type {
  GatewayFailure,
  OnboardingStartInput,
  ProcessInstanceId,
  StartOutcome,
} from "@/lib/datasetOnboarding/types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Structurally identical to `OnboardingSessionScope` in
 * `lib/datasetOnboarding/recovery.ts` and to `OnboardingProcessIdentity` in
 * the monitoring hook, so one resolved scope object can be passed to all
 * three without any of them depending on another.
 */
export interface OnboardingSubmissionIdentity {
  readonly principalId: string;
  readonly gatewayOrigin: string;
}

/** The start half of `OnboardingGateway`. Reads are deliberately not reachable. */
export interface OnboardingStartOperations {
  start(
    input: OnboardingStartInput,
    signal?: AbortSignal,
  ): Promise<StartOutcome>;
}

export interface UseDatasetOnboardingSubmissionInput {
  /** `null` while identity is unresolved. Nothing may be submitted until it resolves. */
  readonly identity: OnboardingSubmissionIdentity | null;
  readonly operations: OnboardingStartOperations;
  /**
   * Storage boundary. Defaults to the browser session store; injected by tests
   * so an unavailable or throwing store is a first-class case.
   */
  readonly storage?: SessionStorageLike | null;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type SubmitResult =
  | { readonly kind: "started"; readonly attemptId: number }
  | { readonly kind: "refused"; readonly block: SubmissionBlock };

export interface DatasetOnboardingSubmissionController {
  readonly status: SubmissionStatus;
  readonly attempt: SubmissionAttempt | null;
  /** The accepted process, or `null`. Retained in memory for this owner. */
  readonly processInstanceId: ProcessInstanceId | null;
  /** A definite pre-start refusal. Nothing was created. */
  readonly rejection: { readonly httpStatus: number } | null;
  /** Why the outcome is unknown. Never a reason to resend. */
  readonly unknownFailure: GatewayFailure | null;
  readonly blocked: SubmissionBlock | null;
  /**
   * The frozen sharing selection of the current attempt, or `null` — which is
   * what the migrated form always produces, and what "this flow asked for no
   * sharing" looks like here. A non-null value records what some earlier
   * context asked for, never what is true: no grant was applied and no
   * visibility was established.
   */
  readonly sharingIntent: SharingIntent | null;
  /** Outcome of the last reference write, for an honest recovery notice. */
  readonly sessionWrite: SessionWriteOutcome | null;
  /**
   * The only path to the start operation. Synchronous up to and including the
   * guard, so a repeat within the same tick is refused rather than dispatched.
   */
  readonly submit: (request: SubmissionRequest) => SubmitResult;
  /** Ends a settled attempt deliberately. Never releases sent references. */
  readonly discard: () => void;
  /** Signals the transport only. It cannot undo a start the server received. */
  readonly abort: () => void;
  /** Injects evidence that named references are still valid and unconsumed. */
  readonly provideStagingValidity: (evidence: StagingValidityEvidence) => void;
  readonly referenceDisposition: (
    reference: string,
  ) => ReferenceDisposition | null;
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

const INACTIVE_SCOPE = "\u0000inactive";

/** NUL-separated, as in the monitoring hook, so no value can forge a key. */
const scopeKeyOf = (identity: OnboardingSubmissionIdentity | null): string => {
  if (identity === null) return INACTIVE_SCOPE;
  const { principalId, gatewayOrigin } = identity;
  if (principalId.trim() === "" || gatewayOrigin.trim() === "") {
    return INACTIVE_SCOPE;
  }
  return `${principalId}\u0000${gatewayOrigin}`;
};

interface ScopedSubmission {
  /**
   * Identifies one owner: this hook instance while it stays mounted on one
   * scope. It is a counter and never a scope key, so returning to an earlier
   * principal or environment creates a *new* owner rather than reviving the
   * old one, and handles issued by that old owner stay stale.
   */
  readonly ownerId: number;
  /** What this state belongs to. State from another scope is never rendered. */
  readonly scopeKey: string;
  readonly state: SubmissionState;
  readonly sessionWrite: SessionWriteOutcome | null;
}

const emptyScoped = (ownerId: number, scopeKey: string): ScopedSubmission => ({
  ownerId,
  scopeKey,
  state: initialSubmissionState(),
  sessionWrite: null,
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDatasetOnboardingSubmission = ({
  identity,
  operations,
  storage: providedStorage,
}: UseDatasetOnboardingSubmissionInput): DatasetOnboardingSubmissionController => {
  const scopeKey = scopeKeyOf(identity);

  const ownerCounterRef = useRef(0);
  const [scoped, setScoped] = useState<ScopedSubmission>(() =>
    emptyScoped((ownerCounterRef.current += 1), scopeKey),
  );

  // The authoritative copy. React state is committed asynchronously, and the
  // duplicate-start guard has to hold within one tick, so every decision reads
  // this ref and every transition writes it before scheduling a render.
  const scopedRef = useRef(scoped);

  // Incremented whenever the scope changes and on teardown, so a promise that
  // resolves late is rejected even by a transport that ignored its signal.
  const generationRef = useRef(0);
  const attemptCounterRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Cleared on the render that changes scope, not in a later effect. An effect
  // would paint one frame of the previous principal's attempt first, which is
  // exactly what "does not reveal cached context belonging to another
  // identity" forbids. The generation is bumped here for the same reason: a
  // result already in flight must not land on the new scope even before the
  // teardown effect runs.
  let current = scoped;
  if (scoped.scopeKey !== scopeKey) {
    current = emptyScoped((ownerCounterRef.current += 1), scopeKey);
    scopedRef.current = current;
    generationRef.current += 1;
    setScoped(current);
  }

  // Latest-value refs for inputs that must *not* invalidate a pending attempt:
  // a refreshed token produces a new operations object for the same principal,
  // and the identity object may be re-created on every render.
  const operationsRef = useRef(operations);
  useEffect(() => {
    operationsRef.current = operations;
  });

  // Captured by every returned action below. `ownerId` comes from the state
  // this render actually shows, so the actions a consumer holds always belong
  // to the owner it is rendering.
  const ownerId = current.ownerId;
  const principalId = identity?.principalId ?? null;
  const gatewayOrigin = identity?.gatewayOrigin ?? null;

  const storage = useMemo(
    () =>
      providedStorage === undefined
        ? getBrowserSessionStorage()
        : providedStorage,
    [providedStorage],
  );
  const storageRef = useRef(storage);
  useEffect(() => {
    storageRef.current = storage;
  });

  useEffect(
    () => () => {
      // Teardown, or a scope change. Bumping here as well means a response that
      // arrives afterwards is rejected even if the transport ignored the abort
      // signal entirely. Aborting is a local signal: a start the server already
      // received is not undone by it, which is why the reference ledger keeps
      // that attempt's uploads unusable.
      generationRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [scopeKey],
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyScoped = useCallback((next: ScopedSubmission): void => {
    scopedRef.current = next;
    setScoped(next);
  }, []);

  /**
   * Whether the owner that issued an action is still the active one.
   *
   * Every returned action is re-created per owner and captures its own
   * `ownerId`, so a handle a consumer kept hold of — a queued form action, a
   * timer, a closure in a component that has since unmounted or switched
   * account — is rejected here *before* it can read, dispatch or mutate
   * anything. Without this, a stable callback would silently act on whichever
   * owner happens to be current.
   */
  const ownerIsActive = useCallback(
    (ownerId: number): boolean =>
      mountedRef.current && scopedRef.current.ownerId === ownerId,
    [],
  );

  const submit = useCallback(
    (request: SubmissionRequest): SubmitResult => {
      // Checked before anything is read from the current owner, so a stale
      // handle can neither dispatch nor observe a replacement owner.
      if (!ownerIsActive(ownerId)) {
        return { kind: "refused", block: { kind: "owner-inactive" } };
      }

      // This owner's identity, captured in the closure rather than read from a
      // ref: an action may only ever be attributed to the scope that issued it.
      const scope =
        principalId === null || gatewayOrigin === null
          ? null
          : { principalId, gatewayOrigin };
      if (scope === null || scopedRef.current.scopeKey === INACTIVE_SCOPE) {
        // No resolved identity: nothing may be attributed, so nothing is sent.
        const block: SubmissionBlock = { kind: "identity-unavailable" };
        applyScoped({
          ...scopedRef.current,
          state: { ...scopedRef.current.state, blocked: block },
        });
        return { kind: "refused", block };
      }

      // The guard. Everything from here to `applyScoped` is synchronous, so a
      // second action in the same tick sees `starting` and is refused.
      const attemptId = attemptCounterRef.current + 1;
      const begun = beginSubmission(
        scopedRef.current.state,
        request,
        attemptId,
      );
      if (begun.kind === "refused") {
        applyScoped({ ...scopedRef.current, state: begun.state });
        return { kind: "refused", block: begun.block };
      }
      attemptCounterRef.current = attemptId;
      applyScoped({
        ...scopedRef.current,
        state: begun.state,
        sessionWrite: null,
      });

      const generation = generationRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const isCurrent = () =>
        generationRef.current === generation && ownerIsActive(ownerId);

      void (async () => {
        let outcome: StartOutcome;
        try {
          outcome = await operationsRef.current.start(
            begun.attempt.submission.startInput,
            controller.signal,
          );
        } catch {
          // The adapter resolves rather than throws, but a throwing injected
          // operation must not escape into a render — and it must not become a
          // *rejection* either: a request that failed in an unknown way may
          // still have been received.
          outcome = { kind: "unknown", failure: { kind: "transient" } };
        }

        // Late response from a superseded scope, or after teardown. The
        // attempt's references stay `possibly-consumed` in the state that was
        // discarded with it; nothing from this scope reaches the new one.
        if (!isCurrent()) return;
        if (abortRef.current === controller) abortRef.current = null;

        const previous = scopedRef.current.state;
        const settled = settleSubmission(previous, attemptId, outcome);
        // An identical reference means the transition was dropped — this is a
        // superseded or already-settled attempt — so neither a render nor a
        // storage write may follow from it.
        if (settled === previous) return;
        applyScoped({ ...scopedRef.current, state: settled });

        // The accepted identity is already retained in memory above. The store
        // is a *hint* for a later refresh, so its failure is reported and
        // nothing is rolled back.
        if (
          settled.status !== "accepted" ||
          settled.processInstanceId === null
        ) {
          return;
        }
        const write = writeSessionRecord(storageRef.current, {
          processInstanceId: settled.processInstanceId,
          scope,
          // Derived from what this attempt actually froze, never from a
          // constant. `null` intent means the flow asked for no sharing at
          // all, so there is nothing to reconcile and the marker is `false`;
          // recording `true` would leave the processing page showing an
          // outstanding sharing task that no action could ever close. A
          // non-null intent keeps the existing `true` marker, because a
          // requested-but-unapplied selection genuinely is unreconciled.
          sharingNeedsReconciliation: begun.attempt.submission.sharing !== null,
        });
        // Re-checked after the write: an identity change during it must not
        // publish this scope's outcome into the next one's render.
        if (!isCurrent()) return;
        applyScoped({ ...scopedRef.current, sessionWrite: write });
      })();

      return { kind: "started", attemptId };
    },
    [applyScoped, gatewayOrigin, ownerId, ownerIsActive, principalId],
  );

  const discard = useCallback(() => {
    if (!ownerIsActive(ownerId)) return;
    const next = discardAttempt(scopedRef.current.state);
    if (next === scopedRef.current.state) return;
    applyScoped({ ...scopedRef.current, state: next, sessionWrite: null });
  }, [applyScoped, ownerId, ownerIsActive]);

  const abort = useCallback(() => {
    // A stale handle must not cancel a replacement owner's in-flight start.
    if (!ownerIsActive(ownerId)) return;
    abortRef.current?.abort();
  }, [ownerId, ownerIsActive]);

  const provideStagingValidity = useCallback(
    (evidence: StagingValidityEvidence) => {
      if (!ownerIsActive(ownerId)) return;
      const next = applyStagingValidityEvidence(
        scopedRef.current.state,
        evidence,
      );
      if (next === scopedRef.current.state) return;
      applyScoped({ ...scopedRef.current, state: next });
    },
    [applyScoped, ownerId, ownerIsActive],
  );

  const dispositionOf = useCallback(
    (reference: string): ReferenceDisposition | null =>
      // Reading is guarded too: a stale accessor must not reveal which uploads
      // a replacement owner has sent.
      ownerIsActive(ownerId)
        ? referenceDisposition(scopedRef.current.state, reference)
        : null,
    [ownerId, ownerIsActive],
  );

  const { state, sessionWrite } = current;

  return {
    status: state.status,
    attempt: state.attempt,
    processInstanceId: state.processInstanceId,
    rejection: state.rejection,
    unknownFailure: state.unknownFailure,
    blocked: state.blocked,
    sharingIntent: state.attempt?.submission.sharing ?? null,
    sessionWrite,
    submit,
    discard,
    abort,
    provideStagingValidity,
    referenceDisposition: dispositionOf,
  };
};
