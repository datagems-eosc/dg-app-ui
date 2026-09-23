"use client";

/**
 * Dataset onboarding — one process reader for one scope.
 *
 * This hook owns lifecycle and nothing else. Decoding belongs to
 * `lib/datasetOnboarding/gateway.ts` and interpretation to its `model.ts`;
 * both are already accepted and are reused here unchanged. What is added is
 * the part neither of them can be responsible for: when to read, when to stop,
 * and which results are still allowed to reach the screen.
 *
 * Read operations are injected rather than imported, so the hook has no
 * dependency on `useApi`, auth or the network. `OnboardingGateway` satisfies
 * `OnboardingProcessReads` structurally; wiring the real transport is task 4.3.
 *
 * Scope is `{ principalId, gatewayOrigin, processInstanceId }` — supplied, not
 * derived. The hook never decodes a bearer token, never uses token text as an
 * identity and never infers a principal from a display name. A same-user token
 * refresh hands it a *new operations object*; that is explicitly not a scope
 * change, so it neither restarts the poller nor discards what is on screen.
 *
 * Deliberately absent: mutations of any kind, grant or sharing policy, dataset
 * readability probes, persistence. Availability and sharing are inputs the
 * caller supplies as evidence; this hook adds no access policy of its own.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildOnboardingView } from "@/lib/datasetOnboarding/model";
import type {
  AccessEvidence,
  ConnectionState,
  GatewayFailure,
  OnboardingConfig,
  OnboardingView,
  ProcessInstanceId,
  ProcessSnapshot,
  ReadResult,
} from "@/lib/datasetOnboarding/types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Structurally identical to `OnboardingSessionScope` in
 * `lib/datasetOnboarding/recovery.ts`, so a route can pass one object to both
 * without either module depending on the other.
 */
export interface OnboardingProcessIdentity {
  readonly principalId: string;
  readonly gatewayOrigin: string;
}

/** The read half of `OnboardingGateway`. Start is deliberately not reachable. */
export interface OnboardingProcessReads {
  getProcess(
    processInstanceId: ProcessInstanceId,
    signal?: AbortSignal,
  ): Promise<ReadResult<ProcessSnapshot>>;
  getConfig(signal?: AbortSignal): Promise<ReadResult<OnboardingConfig>>;
}

export interface MonitoringTiming {
  /** Delay after a completed read, so reads never overlap. */
  readonly intervalMs: number;
  /** Consecutive transient failures step through these, then hold at the last. */
  readonly backoffMs: readonly number[];
}

export const DEFAULT_MONITORING_TIMING: MonitoringTiming = {
  intervalMs: 5_000,
  backoffMs: [10_000, 20_000, 30_000],
};

export interface UseDatasetOnboardingProcessInput {
  /** `null` while identity is unresolved. Nothing is read until it resolves. */
  readonly identity: OnboardingProcessIdentity | null;
  /** `null` when no process is addressed yet. */
  readonly processInstanceId: ProcessInstanceId | null;
  readonly operations: OnboardingProcessReads;
  /** Evidence supplied by the caller; never derived here. */
  readonly access?: AccessEvidence;
  readonly timing?: Partial<MonitoringTiming>;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type MonitoringPhase = "idle" | "polling" | "paused" | "stopped";

export type MonitoringStopReason =
  /** Aggregate reached Failed or Succeeded. Re-reading is still permitted. */
  "terminal" | "access-denied" | "reference-unavailable";

export interface DatasetOnboardingProcessMonitor {
  readonly view: OnboardingView;
  readonly snapshot: ProcessSnapshot | null;
  readonly config: OnboardingConfig | null;
  /** A config read completed and failed. The aggregate is still valid. */
  readonly configurationUnavailable: boolean;
  readonly connection: ConnectionState;
  readonly phase: MonitoringPhase;
  readonly stopReason?: MonitoringStopReason;
  readonly lastFailure: GatewayFailure | null;
  /** Read-only. Never a mutation, never a rerun, never a stage start. */
  readonly checkAgain: () => void;
  /** Re-reads configuration only. Also read-only. */
  readonly retryConfiguration: () => void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface MonitoringState {
  /** What this state belongs to. State from another scope is never rendered. */
  readonly scopeKey: string;
  readonly snapshot: ProcessSnapshot | null;
  readonly config: OnboardingConfig | null;
  readonly configLoaded: boolean;
  readonly connection: ConnectionState;
  readonly lastFailure: GatewayFailure | null;
  readonly phase: MonitoringPhase;
  readonly stopReason?: MonitoringStopReason;
}

const INACTIVE_SCOPE = "\u0000inactive";

/** NUL-separated so no component value can forge another scope's key. */
const scopeKeyOf = (
  identity: OnboardingProcessIdentity | null,
  processInstanceId: ProcessInstanceId | null,
): string => {
  if (identity === null || processInstanceId === null) return INACTIVE_SCOPE;
  const { principalId, gatewayOrigin } = identity;
  if (principalId.trim() === "" || gatewayOrigin.trim() === "") {
    return INACTIVE_SCOPE;
  }
  return `${principalId}\u0000${gatewayOrigin}\u0000${processInstanceId}`;
};

const emptyState = (scopeKey: string): MonitoringState => ({
  scopeKey,
  snapshot: null,
  config: null,
  configLoaded: false,
  connection: "fresh",
  lastFailure: null,
  phase: "idle",
});

/**
 * Failed and Succeeded are the contract's terminal aggregates. An *unknown*
 * numeric status is explicitly not terminal: it may still resolve, and
 * treating it as final would be the coercion the design forbids.
 */
const isTerminal = (snapshot: ProcessSnapshot): boolean =>
  snapshot.status.kind === "known" &&
  (snapshot.status.code === 1 || snapshot.status.code === 2);

const documentHidden = (): boolean =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

interface MonitoringControls {
  checkAgain: () => void;
  retryConfiguration: () => void;
}

const INERT_CONTROLS: MonitoringControls = {
  checkAgain: () => {},
  retryConfiguration: () => {},
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDatasetOnboardingProcess = ({
  identity,
  processInstanceId,
  operations,
  access,
  timing,
}: UseDatasetOnboardingProcessInput): DatasetOnboardingProcessMonitor => {
  const scopeKey = scopeKeyOf(identity, processInstanceId);
  const active = scopeKey !== INACTIVE_SCOPE;

  // Scope components travel as primitives so that a caller re-creating the
  // identity object every render does not restart monitoring.
  const principalId = identity?.principalId ?? null;
  const gatewayOrigin = identity?.gatewayOrigin ?? null;

  const [state, setState] = useState<MonitoringState>(() =>
    emptyState(scopeKey),
  );

  // Clear on the render that changes scope, not in a later effect. An effect
  // would paint one frame of the previous principal's process first, which is
  // exactly what "does not reveal cached context belonging to another
  // identity" forbids. React re-renders with this value before committing.
  let current = state;
  if (state.scopeKey !== scopeKey) {
    current = emptyState(scopeKey);
    setState(current);
  }

  // Latest-value refs for inputs that must *not* restart the loop: a refreshed
  // token produces a new operations object for the same principal, and timing
  // is tuning rather than scope. The running loop reads them when it acts.
  const operationsRef = useRef(operations);
  const timingRef = useRef<MonitoringTiming>({
    ...DEFAULT_MONITORING_TIMING,
    ...timing,
  });
  useEffect(() => {
    operationsRef.current = operations;
    timingRef.current = { ...DEFAULT_MONITORING_TIMING, ...timing };
  });

  // Incremented on every effect start *and* teardown, so a promise that
  // resolves late is rejected even by a transport that ignored its signal.
  const generationRef = useRef(0);
  const controlsRef = useRef<MonitoringControls>(INERT_CONTROLS);

  useEffect(() => {
    if (
      principalId === null ||
      gatewayOrigin === null ||
      processInstanceId === null ||
      principalId.trim() === "" ||
      gatewayOrigin.trim() === ""
    ) {
      // Unresolved identity: no reads at all, not even one.
      controlsRef.current = INERT_CONTROLS;
      return;
    }

    const generation = (generationRef.current += 1);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let processController: AbortController | null = null;
    let configController: AbortController | null = null;
    let readInFlight = false;
    let configInFlight = false;
    let stopped = false;
    let failureStreak = 0;
    let paused = documentHidden();

    const isCurrent = () => !cancelled && generationRef.current === generation;

    const commit = (patch: Partial<MonitoringState>) => {
      if (!isCurrent()) return;
      setState((previous) =>
        previous.scopeKey === scopeKey ? { ...previous, ...patch } : previous,
      );
    };

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const nextDelay = (): number => {
      const { intervalMs, backoffMs } = timingRef.current;
      if (failureStreak === 0 || backoffMs.length === 0) return intervalMs;
      return backoffMs[Math.min(failureStreak - 1, backoffMs.length - 1)];
    };

    const schedule = () => {
      clearTimer();
      if (!isCurrent() || stopped || paused || readInFlight) return;
      timer = setTimeout(() => {
        timer = null;
        void readProcess();
      }, nextDelay());
    };

    const applyResult = (result: ReadResult<ProcessSnapshot>) => {
      if (result.ok) {
        failureStreak = 0;
        // Recomputed rather than latched: a successful read after an access
        // failure legitimately resumes polling.
        stopped = isTerminal(result.value);
        commit({
          snapshot: result.value,
          connection: "fresh",
          lastFailure: null,
          phase: stopped ? "stopped" : paused ? "paused" : "polling",
          ...(stopped
            ? { stopReason: "terminal" as const }
            : { stopReason: undefined }),
        });
        return;
      }

      const failure = result.failure;
      // We are the only caller that aborts, and teardown already rejected this
      // path, so a cancellation carries no information about the process.
      if (failure.kind === "cancelled") return;

      if (failure.kind === "unauthorized" || failure.kind === "forbidden") {
        // A confirmed denial is not retried on a timer.
        stopped = true;
        commit({
          connection: "forbidden",
          lastFailure: failure,
          phase: "stopped",
          stopReason: "access-denied",
        });
        return;
      }

      if (failure.kind === "unavailable-reference") {
        // 404 does not assert deletion, but polling it on a timer is noise.
        stopped = true;
        commit({
          connection: "unavailable",
          lastFailure: failure,
          phase: "stopped",
          stopReason: "reference-unavailable",
        });
        return;
      }

      // transient | malformed: keep reading, more slowly each time. A previous
      // snapshot survives as stale rather than being discarded.
      //
      // A monitor that is already stopped stays stopped. This branch is
      // reachable while stopped only through a manual recheck, and `schedule()`
      // would refuse to arm a timer anyway — so reporting `polling` here would
      // promise an automatic retry that never comes. The stop and its reason
      // are kept, the new failure is still surfaced, the control stays
      // manually retryable, and only a *successful* read lifts the stop.
      failureStreak += 1;
      setState((previous) => {
        if (previous.scopeKey !== scopeKey) return previous;
        return {
          ...previous,
          connection: previous.snapshot === null ? "unavailable" : "stale",
          lastFailure: failure,
          phase: stopped ? "stopped" : paused ? "paused" : "polling",
          // `previous.stopReason` is preserved while stopped; an active
          // monitor clears it, since it is not stopped for any reason.
          ...(stopped ? {} : { stopReason: undefined }),
        };
      });
    };

    const readProcess = async () => {
      // A manual check arriving during a read coalesces into it: no second
      // concurrent request is issued for the same question.
      if (!isCurrent() || readInFlight) return;
      readInFlight = true;
      clearTimer();
      const controller = new AbortController();
      processController = controller;

      let result: ReadResult<ProcessSnapshot>;
      try {
        result = await operationsRef.current.getProcess(
          processInstanceId,
          controller.signal,
        );
      } catch {
        // The adapter resolves rather than throws; a throwing injected
        // operation must still not escape into a render.
        result = { ok: false, failure: { kind: "transient" } };
      }

      readInFlight = false;
      // Late response from a superseded scope, or after teardown.
      if (!isCurrent()) return;
      applyResult(result);
      schedule();
    };

    const loadConfig = async () => {
      if (!isCurrent() || configInFlight) return;
      configInFlight = true;
      const controller = new AbortController();
      configController = controller;

      let result: ReadResult<OnboardingConfig>;
      try {
        result = await operationsRef.current.getConfig(controller.signal);
      } catch {
        result = { ok: false, failure: { kind: "transient" } };
      }

      configInFlight = false;
      // An obsolete configuration load never lands on a newer scope.
      if (!isCurrent()) return;
      if (result.ok) {
        commit({ config: result.value, configLoaded: true });
      } else if (result.failure.kind !== "cancelled") {
        // Configuration failure never discards a valid aggregate and never
        // stops status polling; the model renders the honest fallback.
        commit({ config: null, configLoaded: true });
      }
    };

    const onVisibilityChange = () => {
      const hidden = documentHidden();
      if (hidden === paused) return;
      paused = hidden;

      if (paused) {
        // An in-flight read is left to finish; it simply will not reschedule.
        clearTimer();
        commit({ phase: stopped ? "stopped" : "paused" });
        return;
      }

      commit({ phase: stopped ? "stopped" : "polling" });
      if (stopped || readInFlight) return;
      void readProcess();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    controlsRef.current = {
      checkAgain: () => {
        if (!isCurrent() || readInFlight) return;
        clearTimer();
        void readProcess();
      },
      retryConfiguration: () => {
        if (!isCurrent()) return;
        void loadConfig();
      },
    };

    commit({ phase: paused ? "paused" : "polling" });
    // Configuration is a single read per scope, not part of the poll loop, so
    // it is not gated on visibility. Status reads are.
    void loadConfig();
    if (!paused) void readProcess();

    return () => {
      cancelled = true;
      // Bumping here as well means a response that arrives after teardown is
      // rejected even if the transport ignored the abort signal entirely.
      generationRef.current += 1;
      clearTimer();
      processController?.abort();
      configController?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      controlsRef.current = INERT_CONTROLS;
    };
    // `operations` and `timing` are intentionally excluded: they are read
    // through refs so a refreshed transport does not restart the poller.
  }, [principalId, gatewayOrigin, processInstanceId, scopeKey]);

  const checkAgain = useCallback(() => {
    controlsRef.current.checkAgain();
  }, []);
  const retryConfiguration = useCallback(() => {
    controlsRef.current.retryConfiguration();
  }, []);

  const availability = access?.availability ?? "unknown";
  const sharing = access?.sharing ?? "not-confirmed";
  const dmmReady = access?.dmmReady;
  const accessEvidence = useMemo<AccessEvidence>(
    () => ({
      availability,
      sharing,
      ...(dmmReady === undefined ? {} : { dmmReady }),
    }),
    [availability, sharing, dmmReady],
  );

  const { snapshot, config, connection } = current;
  const view = useMemo(
    () =>
      buildOnboardingView({
        snapshot,
        config,
        access: accessEvidence,
        connection,
      }),
    [snapshot, config, accessEvidence, connection],
  );

  return {
    view,
    snapshot,
    config,
    configurationUnavailable: current.configLoaded && config === null,
    connection,
    phase: active ? current.phase : "idle",
    ...(current.stopReason === undefined
      ? {}
      : { stopReason: current.stopReason }),
    lastFailure: current.lastFailure,
    checkAgain,
    retryConfiguration,
  };
};
