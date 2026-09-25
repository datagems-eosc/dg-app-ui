"use client";

/**
 * Dataset onboarding — scoped dataset availability lifecycle.
 *
 * The accepted route controller can *accept* access evidence but has no way to
 * obtain it. This hook is that missing half, and nothing more: it asks the
 * injected reader whether one dataset's metadata is readable for one principal
 * in one environment, and it forgets the answer the moment any part of that
 * scope changes.
 *
 * Deliberately absent: grants, permission endpoints, role inference, title
 * search, storage, and any second process poller. It reads one dataset, by the
 * id the process itself reported.
 *
 * The retry budget is a **UI politeness limit**, not a service timing
 * guarantee: three reads at most, then stop and let the user ask. Nothing here
 * promises when a Gateway finishes propagating anything.
 *
 * Two kinds of read share one transport and nothing else. The **automatic**
 * cycle starts when the caller reports completion: one immediate read, then at
 * most two retries. A **manual** read (`checkNow`) is allowed as soon as the
 * scope is known, even while the process is still running; it updates what we
 * believe about the dataset and neither spends nor ends the automatic budget.
 * So a completion observed after any number of manual reads, whatever they
 * were answered, still gets its immediate read and its retries.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DatasetAccessOutcome } from "@/lib/datasetOnboarding/access";
import type {
  DatasetAvailability,
  DatasetId,
  ProcessInstanceId,
} from "@/lib/datasetOnboarding/types";

/**
 * Everything an availability answer belongs to. No token and no email: a
 * principal id and the environment identity are what make two answers
 * comparable, and anything more would be a credential living in state.
 */
export interface OnboardingAccessScope {
  readonly principalId: string;
  /** The whole configured Gateway base, including path — not just an origin. */
  readonly gatewayOrigin: string;
  readonly processInstanceId: ProcessInstanceId;
  readonly datasetId: DatasetId;
}

export type DatasetAccessRead = (
  datasetId: DatasetId,
  signal?: AbortSignal,
) => Promise<DatasetAccessOutcome>;

export interface AccessTiming {
  readonly retryDelayMs: number;
  /** One immediate read plus at most two more. */
  readonly maxAttempts: number;
}

export const DEFAULT_ACCESS_TIMING: AccessTiming = {
  retryDelayMs: 5_000,
  maxAttempts: 3,
};

export interface UseDatasetOnboardingAccessInput {
  /** `null` whenever any part of the scope is unresolved. Nothing is read. */
  readonly scope: OnboardingAccessScope | null;
  readonly readDataset: DatasetAccessRead;
  /**
   * Whether the automatic cycle may run. The page passes "the aggregate says
   * Succeeded" — an inconsistent display is not a completion, and a running
   * process has nothing to confirm yet. A manual check does not need this.
   */
  readonly automatic: boolean;
  readonly timing?: Partial<AccessTiming>;
}

export interface DatasetOnboardingAccessState {
  readonly availability: DatasetAvailability;
  /** Only ever from the matching successful read. Never stored, never guessed. */
  readonly datasetName?: string;
  /**
   * Automatic reads performed for this scope, out of `maxAttempts`. Manual
   * reads are not counted: they neither spend nor restore this budget.
   */
  readonly attemptsUsed: number;
  /**
   * The automatic cycle will not read again on its own for this scope: it has
   * confirmed, been refused, seen an unusable session or a malformed body, or
   * spent its budget. A manual read can neither set nor clear this.
   */
  readonly automaticStopped: boolean;
  /**
   * A dataset read for the current scope, automatic or manual, has been
   * dispatched and has not settled. Presentation evidence only; it neither
   * spends nor restores the budget and never schedules anything.
   */
  readonly checking: boolean;
  /**
   * One read, on request, whenever the scope is resolved. Outside the
   * automatic budget: it is not an attempt, it never stops the automatic
   * cycle and it never schedules a retry. Coalesces with a read in flight.
   */
  readonly checkNow: () => void;
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

const INACTIVE_SCOPE = "\u0000inactive";

/** NUL-separated, as in the accepted hooks, so no value can forge another key. */
const scopeKeyOf = (scope: OnboardingAccessScope | null): string => {
  if (scope === null) return INACTIVE_SCOPE;
  const { principalId, gatewayOrigin, processInstanceId, datasetId } = scope;
  if (
    principalId.trim() === "" ||
    gatewayOrigin.trim() === "" ||
    String(processInstanceId).trim() === "" ||
    String(datasetId).trim() === ""
  ) {
    return INACTIVE_SCOPE;
  }
  return [principalId, gatewayOrigin, processInstanceId, datasetId].join(
    "\u0000",
  );
};

interface AccessState {
  readonly scopeKey: string;
  /** Updated by every committed read, manual or automatic. */
  readonly availability: DatasetAvailability;
  readonly datasetName?: string;
  /** Automatic cycle only; see `DatasetOnboardingAccessState`. */
  readonly attemptsUsed: number;
  /** Automatic cycle only; see `DatasetOnboardingAccessState`. */
  readonly automaticStopped: boolean;
  /** Mirrors this scope's `inFlight`; see `DatasetOnboardingAccessState`. */
  readonly checking: boolean;
}

const emptyState = (scopeKey: string): AccessState => ({
  scopeKey,
  availability: "unknown",
  attemptsUsed: 0,
  automaticStopped: false,
  checking: false,
});

/**
 * How one completed read changes what we believe.
 *
 * A later failure *removes* a previously confirmed answer rather than leaving a
 * stale "readable" on screen: the action it unlocks would otherwise outlive the
 * evidence for it.
 */
const availabilityOf = (outcome: DatasetAccessOutcome): DatasetAvailability => {
  if (outcome.kind === "readable") return "readable";
  // 403 is the only stable refusal. A 401 says the session is unusable and a
  // 404 says the reference did not resolve; neither states that this principal
  // is forbidden, so both stay unknown.
  if (outcome.kind === "denied") return "denied";
  return "unknown";
};

/** Whether the automatic cycle has anything left to gain from another read. */
const stopsAutomatic = (outcome: DatasetAccessOutcome): boolean => {
  switch (outcome.kind) {
    case "readable":
    case "denied":
    case "auth-unusable":
      return true;
    case "unknown":
      // A malformed body, or an id that is not the one we asked about, is a
      // contract problem; repeating the same request cannot fix it. Only a
      // transient fault is worth another attempt.
      return outcome.reason !== "transient";
    default:
      return false;
  }
};

const documentHidden = (): boolean =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

interface AccessControls {
  checkNow: () => void;
}

const INERT_CONTROLS: AccessControls = { checkNow: () => {} };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDatasetOnboardingAccess = ({
  scope,
  readDataset,
  automatic,
  timing,
}: UseDatasetOnboardingAccessInput): DatasetOnboardingAccessState => {
  const scopeKey = scopeKeyOf(scope);
  const active = scopeKey !== INACTIVE_SCOPE;

  // Primitives, so a caller rebuilding the scope object every render does not
  // restart anything.
  const principalId = scope?.principalId ?? null;
  const gatewayOrigin = scope?.gatewayOrigin ?? null;
  const processInstanceId = scope?.processInstanceId ?? null;
  const datasetId = scope?.datasetId ?? null;

  const [state, setState] = useState<AccessState>(() => emptyState(scopeKey));

  // Cleared on the render that changes scope, never in a later effect: an
  // effect would paint one frame of the previous principal's dataset name and
  // its View dataset action first.
  const current = state.scopeKey === scopeKey ? state : emptyState(scopeKey);

  // Read through refs so a refreshed transport or a new timing object does not
  // restart the cycle or reset the budget.
  const readRef = useRef(readDataset);
  readRef.current = readDataset;
  const timingRef = useRef<AccessTiming>(DEFAULT_ACCESS_TIMING);
  timingRef.current = { ...DEFAULT_ACCESS_TIMING, ...timing };

  /**
   * The automatic cycle's budget, and only that: manual reads never touch it.
   * Survives effect re-runs inside one scope. A visibility change or an
   * eligibility flip resumes the cycle where it stopped rather than handing it
   * a fresh budget.
   */
  const budgetRef = useRef<{
    scopeKey: string;
    attempts: number;
    stopped: boolean;
  }>({ scopeKey: INACTIVE_SCOPE, attempts: 0, stopped: false });

  const generationRef = useRef(0);
  const controlsRef = useRef<AccessControls>(INERT_CONTROLS);

  useEffect(() => {
    if (!active || datasetId === null) {
      // Bumped so a response still in flight for a previous scope is rejected
      // rather than committed into an inactive view.
      generationRef.current += 1;
      controlsRef.current = INERT_CONTROLS;
      return;
    }

    if (budgetRef.current.scopeKey !== scopeKey) {
      budgetRef.current = { scopeKey, attempts: 0, stopped: false };
    }

    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    /** Which kind of read holds the transport, if any. Never two at once. */
    let inFlight: "automatic" | "manual" | null = null;
    /**
     * An automatic read fell due while a manual one held the transport. It is
     * neither dropped nor doubled: it runs as soon as that read settles.
     */
    let automaticQueued = false;
    let paused = documentHidden();

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    /** Nothing left for the automatic cycle to do: confirmed, refused or spent. */
    const automaticExhausted = () =>
      budgetRef.current.stopped ||
      budgetRef.current.attempts >= timingRef.current.maxAttempts;

    const commit = (outcome: DatasetAccessOutcome, isAutomatic: boolean) => {
      // Only the automatic cycle spends the budget or can end it. A manual read
      // changes what we believe about the dataset and nothing else.
      if (isAutomatic) {
        budgetRef.current.attempts += 1;
        if (stopsAutomatic(outcome)) budgetRef.current.stopped = true;
      }

      const availability = availabilityOf(outcome);
      const name = outcome.kind === "readable" ? outcome.name : undefined;

      setState({
        scopeKey,
        availability,
        // The name lives and dies with the read that produced it.
        ...(name === undefined ? {} : { datasetName: name }),
        attemptsUsed: budgetRef.current.attempts,
        automaticStopped: automaticExhausted(),
        checking: false,
      });
    };

    /**
     * Observational only. Guarded by generation and scope, so a read that
     * belongs to an abandoned generation can neither set nor clear it.
     */
    const setChecking = (checking: boolean) => {
      if (!isCurrent()) return;
      setState((previous) =>
        previous.scopeKey === scopeKey && previous.checking !== checking
          ? { ...previous, checking }
          : previous,
      );
    };

    const scheduleNext = () => {
      if (paused || automaticExhausted()) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        runAutomatic();
      }, timingRef.current.retryDelayMs);
    };

    /**
     * The automatic cycle's own entry point. It never overlaps a read and never
     * gives one up: a manual read holding the transport hands over on settling.
     */
    const runAutomatic = () => {
      if (inFlight === "manual") {
        automaticQueued = true;
        return;
      }
      void runRead(true);
    };

    const runRead = async (isAutomatic: boolean) => {
      if (!isCurrent() || inFlight !== null) return;
      if (isAutomatic && automaticExhausted()) return;

      inFlight = isAutomatic ? "automatic" : "manual";
      controller = new AbortController();
      // The state may still belong to an earlier scope on the first read; the
      // flag is written into this scope's state either way.
      setState((previous) =>
        previous.scopeKey === scopeKey
          ? { ...previous, checking: true }
          : { ...emptyState(scopeKey), checking: true },
      );
      let outcome: DatasetAccessOutcome;
      try {
        outcome = await readRef.current(datasetId, controller.signal);
      } catch {
        // A reader is not supposed to throw; treat it as an unreadable answer
        // rather than letting it escape into a render.
        outcome = { kind: "unknown", reason: "transient" };
      } finally {
        inFlight = null;
        controller = null;
      }

      // A late body for a scope we have left is discarded, whether or not the
      // transport honoured the abort signal.
      if (!isCurrent()) return;
      setChecking(false);
      if (outcome.kind !== "cancelled") {
        commit(outcome, isAutomatic);
        if (isAutomatic) scheduleNext();
      }

      // An automatic read that fell due during this manual one runs now.
      if (automaticQueued) {
        automaticQueued = false;
        if (!paused) void runRead(true);
      }
    };

    const onVisibilityChange = () => {
      const hidden = documentHidden();
      if (hidden === paused) return;
      paused = hidden;
      if (paused) {
        // An in-flight read is left to finish; it simply will not reschedule.
        clearTimer();
        return;
      }
      // Resuming continues the same budget. It does not grant a new one.
      if (!automatic || automaticExhausted()) return;
      // An automatic read in flight reschedules itself; a manual one hands
      // over when it settles.
      if (inFlight === "automatic") return;
      if (inFlight === "manual") {
        automaticQueued = true;
        return;
      }
      if (budgetRef.current.attempts === 0) void runRead(true);
      else scheduleNext();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    controlsRef.current = {
      // Allowed before completion and outside the automatic cycle. One read,
      // coalesced with anything already in flight; it is not counted as an
      // attempt, cannot stop the cycle and never starts or extends the
      // automatic retry sequence.
      checkNow: () => {
        if (!isCurrent() || inFlight !== null) return;
        void runRead(false);
      },
    };

    // The automatic cycle starts only when the caller says the process reports
    // completion, and only if this scope has not already finished with it.
    if (
      automatic &&
      !paused &&
      !budgetRef.current.stopped &&
      budgetRef.current.attempts === 0
    ) {
      void runRead(true);
    }

    return () => {
      // An aborted read of this generation never settles into state. Same
      // scope (an eligibility flip re-runs this effect) must not inherit it.
      if (inFlight !== null) {
        setState((previous) =>
          previous.scopeKey === scopeKey && previous.checking
            ? { ...previous, checking: false }
            : previous,
        );
      }
      generationRef.current += 1;
      clearTimer();
      controller?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      controlsRef.current = INERT_CONTROLS;
    };
    // `readDataset` and `timing` are read through refs on purpose.
  }, [
    active,
    scopeKey,
    principalId,
    gatewayOrigin,
    processInstanceId,
    datasetId,
    automatic,
  ]);

  const checkNow = useCallback(() => {
    controlsRef.current.checkNow();
  }, []);

  return {
    availability: current.availability,
    ...(current.datasetName === undefined
      ? {}
      : { datasetName: current.datasetName }),
    attemptsUsed: current.attemptsUsed,
    automaticStopped: current.automaticStopped,
    checking: active && current.checking,
    checkNow,
  };
};
