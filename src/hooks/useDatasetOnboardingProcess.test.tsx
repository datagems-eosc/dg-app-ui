import { act, renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeConfig,
  decodeProcessSnapshot,
} from "@/lib/datasetOnboarding/decode";
import {
  onboardingConfigPayload,
  PROCESS_INSTANCE_ID,
  runningProcess,
  stepsAbsentProcess,
  succeededProcess,
  succeededWithFailedStepProcess,
} from "@/lib/datasetOnboarding/fixtures";
import { hasNotice } from "@/lib/datasetOnboarding/model";
import {
  asProcessInstanceId,
  type GatewayFailure,
  type OnboardingConfig,
  type ProcessSnapshot,
  type ReadResult,
  type WorkflowProcessConfigDto,
  type WorkflowProcessDto,
} from "@/lib/datasetOnboarding/types";
import {
  type OnboardingProcessReads,
  type UseDatasetOnboardingProcessInput,
  useDatasetOnboardingProcess,
} from "./useDatasetOnboardingProcess";

// ---------------------------------------------------------------------------
// Scope, fixtures and fake reads
// ---------------------------------------------------------------------------

const IDENTITY = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
};

const OTHER_IDENTITY = {
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
  gatewayOrigin: IDENTITY.gatewayOrigin,
};

const PROCESS = asProcessInstanceId(PROCESS_INSTANCE_ID);
const OTHER_PROCESS = asProcessInstanceId(
  "8f1d0c92-6b3a-4e77-9a05-1d4e8c7b2f60",
);

/** Decoded through the accepted decoder so tests share one contract shape. */
const snapshotOf = (payload: WorkflowProcessDto): ProcessSnapshot => {
  const decoded = decodeProcessSnapshot(payload);
  if (!decoded.ok) throw new Error(`fixture does not decode: ${payload.id}`);
  return decoded.value;
};

const configOf = (payload: WorkflowProcessConfigDto): OnboardingConfig => {
  const decoded = decodeConfig(payload);
  if (!decoded.ok) throw new Error("config fixture does not decode");
  return decoded.value;
};

const ok = (payload: WorkflowProcessDto): ReadResult<ProcessSnapshot> => ({
  ok: true,
  value: snapshotOf(payload),
});

const fails = (failure: GatewayFailure): ReadResult<ProcessSnapshot> => ({
  ok: false,
  failure,
});

const TRANSIENT: GatewayFailure = { kind: "transient", httpStatus: 503 };

type ProcessResponder = (
  callNumber: number,
) => ReadResult<ProcessSnapshot> | Promise<ReadResult<ProcessSnapshot>>;

type ConfigResponder = (
  callNumber: number,
) => ReadResult<OnboardingConfig> | Promise<ReadResult<OnboardingConfig>>;

/**
 * Fake read operations. No transport, no network: the hook's contract is the
 * injected `OnboardingProcessReads`, and every assertion below is about when
 * it is called and which results are allowed to land.
 *
 * `start` is present only to prove it is never reachable from this hook.
 */
const createReads = (
  respond: ProcessResponder,
  respondConfig?: ConfigResponder,
) => {
  const processIds: string[] = [];
  const processSignals: (AbortSignal | undefined)[] = [];
  const configSignals: (AbortSignal | undefined)[] = [];
  const start = vi.fn();

  const reads: OnboardingProcessReads & { start: typeof start } = {
    start,
    getProcess: async (processInstanceId, signal) => {
      processIds.push(processInstanceId);
      processSignals.push(signal);
      return respond(processIds.length);
    },
    getConfig: async (signal) => {
      configSignals.push(signal);
      return respondConfig
        ? respondConfig(configSignals.length)
        : { ok: true, value: configOf(onboardingConfigPayload) };
    },
  };

  return { reads, processIds, processSignals, configSignals, start };
};

const deferred = <T,>() => {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const renderMonitor = (
  props: UseDatasetOnboardingProcessInput,
  wrapper?: (props: { children: ReactNode }) => ReactNode,
) =>
  renderHook(
    (current: UseDatasetOnboardingProcessInput) =>
      useDatasetOnboardingProcess(current),
    { initialProps: props, ...(wrapper ? { wrapper } : {}) },
  );

interface RenderRecord {
  readonly principalId: string | null;
  readonly gatewayOrigin: string | null;
  readonly processInstanceId: string | null;
  readonly processing: string;
  readonly hasSnapshot: boolean;
  readonly hasConfig: boolean;
  readonly datasetId?: string;
}

/**
 * Records what each individual render returned.
 *
 * `rerender` is wrapped in `act`, so reading `result.current` afterwards only
 * ever shows the state *after* effects have run — which cannot tell "cleared
 * during the render that changed scope" apart from "cleared one render later
 * by an effect". The second is what the isolation requirement forbids, so the
 * assertions below look at the per-render sequence instead.
 */
const renderMonitorRecording = (props: UseDatasetOnboardingProcessInput) => {
  const renders: RenderRecord[] = [];
  const harness = renderHook(
    (current: UseDatasetOnboardingProcessInput) => {
      const monitor = useDatasetOnboardingProcess(current);
      renders.push({
        principalId: current.identity?.principalId ?? null,
        gatewayOrigin: current.identity?.gatewayOrigin ?? null,
        processInstanceId: current.processInstanceId,
        processing: monitor.view.processing,
        hasSnapshot: monitor.snapshot !== null,
        hasConfig: monitor.config !== null,
        ...(monitor.view.datasetId === undefined
          ? {}
          : { datasetId: monitor.view.datasetId }),
      });
      return monitor;
    },
    { initialProps: props },
  );
  return { ...harness, renders };
};

/** Advances fake time and flushes the promises it releases. */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Flushes pending microtasks without moving the clock. */
const settle = () => advance(0);

const setVisibility = async (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  await setVisibility("visible");
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Identity gating
// ---------------------------------------------------------------------------

describe("unresolved identity", () => {
  it.each([
    ["no identity", null, PROCESS],
    ["a blank principal", { ...IDENTITY, principalId: "" }, PROCESS],
    ["a blank environment", { ...IDENTITY, gatewayOrigin: "   " }, PROCESS],
    ["no process reference", IDENTITY, null],
  ])("issues no read with %s", async (_label, identity, processInstanceId) => {
    const { reads, processIds, configSignals } = createReads(() =>
      ok(runningProcess),
    );

    const { result } = renderMonitor({
      identity,
      processInstanceId,
      operations: reads,
    });
    await advance(30_000);

    expect(processIds).toHaveLength(0);
    expect(configSignals).toHaveLength(0);
    expect(result.current.phase).toBe("idle");
    expect(result.current.view.processing).toBe("loading");
  });

  it("starts reading once identity resolves, and stops again if it is lost", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, rerender } = renderMonitor({ identity: null, ...base });
    await settle();
    expect(processIds).toHaveLength(0);

    rerender({ identity: IDENTITY, ...base });
    await settle();
    expect(processIds).toHaveLength(1);
    expect(result.current.view.processing).toBe("running");

    // Identity lost: nothing of the previous principal stays on screen, and no
    // further read is issued.
    rerender({ identity: null, ...base });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.view.processing).toBe("loading");
    await advance(30_000);
    expect(processIds).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Polling cadence
// ---------------------------------------------------------------------------

describe("polling cadence", () => {
  it("reads immediately, then every 5 seconds after completion", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(processIds).toEqual([PROCESS_INSTANCE_ID]);
    expect(result.current.phase).toBe("polling");
    expect(result.current.connection).toBe("fresh");

    await advance(4_999);
    expect(processIds).toHaveLength(1);
    await advance(1);
    expect(processIds).toHaveLength(2);
    await advance(5_000);
    expect(processIds).toHaveLength(3);
  });

  it("never overlaps reads: the delay starts when the previous one completes", async () => {
    const slow = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds } = createReads((call) =>
      call === 1 ? slow.promise : ok(runningProcess),
    );

    renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    // Four poll intervals pass while the first read is outstanding.
    await advance(20_000);
    expect(processIds).toHaveLength(1);

    await act(async () => {
      slow.settle(ok(runningProcess));
      await Promise.resolve();
    });

    await advance(4_999);
    expect(processIds).toHaveLength(1);
    await advance(1);
    expect(processIds).toHaveLength(2);
  });

  it("backs off 10/20/30 seconds, holds at 30, and resets after a success", async () => {
    const { reads, processIds } = createReads((call) =>
      call <= 4 ? fails(TRANSIENT) : ok(runningProcess),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(processIds).toHaveLength(1);

    await advance(9_999);
    expect(processIds).toHaveLength(1);
    await advance(1);
    expect(processIds).toHaveLength(2);

    await advance(19_999);
    expect(processIds).toHaveLength(2);
    await advance(1);
    expect(processIds).toHaveLength(3);

    await advance(29_999);
    expect(processIds).toHaveLength(3);
    await advance(1);
    expect(processIds).toHaveLength(4);

    // A fourth consecutive failure holds at the last step rather than growing.
    await advance(29_999);
    expect(processIds).toHaveLength(4);
    await advance(1);
    expect(processIds).toHaveLength(5);
    expect(result.current.view.processing).toBe("running");

    // Success resets the streak to the ordinary interval.
    await advance(5_000);
    expect(processIds).toHaveLength(6);
  });

  it("keeps the last snapshot as stale after a read failure", async () => {
    const { reads } = createReads((call) =>
      call === 1 ? ok(runningProcess) : fails(TRANSIENT),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    await advance(5_000);

    expect(result.current.connection).toBe("stale");
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.view.processing).toBe("running");
    expect(hasNotice(result.current.view, "connection-stale")).toBe(true);
    expect(result.current.lastFailure).toEqual(TRANSIENT);
    // An *active* monitor is still polling and carries no stop reason.
    expect(result.current.phase).toBe("polling");
    expect(result.current.stopReason).toBeUndefined();
  });

  it("reports unavailable while no snapshot has ever been read", async () => {
    const { reads } = createReads(() => fails(TRANSIENT));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.connection).toBe("unavailable");
    expect(result.current.view.processing).toBe("loading");
    expect(hasNotice(result.current.view, "connection-unavailable")).toBe(true);
  });

  it("treats a malformed response as a read failure, not as an outcome", async () => {
    const malformed: GatewayFailure = { kind: "malformed", httpStatus: 200 };
    const { reads, processIds } = createReads((call) =>
      call === 1 ? ok(runningProcess) : fails(malformed),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    await advance(5_000);

    expect(result.current.view.processing).toBe("running");
    expect(result.current.connection).toBe("stale");
    // Backed off rather than declared terminal.
    await advance(9_999);
    expect(processIds).toHaveLength(2);
    await advance(1);
    expect(processIds).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Stopping
// ---------------------------------------------------------------------------

describe("stopping", () => {
  it("stops on a terminal aggregate but still allows a read-only recheck", async () => {
    const { reads, processIds } = createReads(() => ok(succeededProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.view.processing).toBe("succeeded");
    expect(result.current.phase).toBe("stopped");
    expect(result.current.stopReason).toBe("terminal");

    await advance(60_000);
    expect(processIds).toHaveLength(1);

    await act(async () => {
      result.current.checkAgain();
      await Promise.resolve();
    });
    expect(processIds).toHaveLength(2);
  });

  it("stops on a contradictory completion without claiming readiness", async () => {
    const { reads } = createReads(() => ok(succeededWithFailedStepProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.view.processing).toBe("inconsistent");
    expect(hasNotice(result.current.view, "status-inconsistent")).toBe(true);
    expect(result.current.phase).toBe("stopped");
  });

  it("does not treat an unknown aggregate status as terminal", async () => {
    const unknownStatus: WorkflowProcessDto = { ...runningProcess, status: 7 };
    const { reads, processIds } = createReads(() => ok(unknownStatus));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.view.processing).toBe("unknown");
    expect(result.current.phase).toBe("polling");
    await advance(5_000);
    expect(processIds).toHaveLength(2);
  });

  it.each([
    ["403", { kind: "forbidden", httpStatus: 403 } as GatewayFailure],
    ["401", { kind: "unauthorized", httpStatus: 401 } as GatewayFailure],
  ])("stops polling on a confirmed %s denial", async (_label, failure) => {
    const { reads, processIds } = createReads(() => fails(failure));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.connection).toBe("forbidden");
    expect(result.current.phase).toBe("stopped");
    expect(result.current.stopReason).toBe("access-denied");
    expect(hasNotice(result.current.view, "connection-forbidden")).toBe(true);

    await advance(60_000);
    expect(processIds).toHaveLength(1);
  });

  it("stops on an unavailable reference without asserting deletion", async () => {
    const { reads, processIds } = createReads(() =>
      fails({ kind: "unavailable-reference", httpStatus: 404 }),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.connection).toBe("unavailable");
    expect(result.current.stopReason).toBe("reference-unavailable");
    await advance(60_000);
    expect(processIds).toHaveLength(1);
  });

  it.each([
    ["a terminal success", "terminal" as const, "stale" as const, TRANSIENT],
    [
      "a 403 denial",
      "access-denied" as const,
      "unavailable" as const,
      TRANSIENT,
    ],
    [
      "a 404 unavailable reference",
      "reference-unavailable" as const,
      "unavailable" as const,
      { kind: "malformed", httpStatus: 200 } as GatewayFailure,
    ],
  ])(
    "keeps the stop after %s when a manual recheck fails",
    async (_label, stopReason, connection, failure) => {
      const initial: ReadResult<ProcessSnapshot> =
        stopReason === "terminal"
          ? ok(succeededProcess)
          : stopReason === "access-denied"
            ? fails({ kind: "forbidden", httpStatus: 403 })
            : fails({ kind: "unavailable-reference", httpStatus: 404 });
      const { reads, processIds } = createReads((call) =>
        call === 1 ? initial : fails(failure),
      );

      const { result } = renderMonitor({
        identity: IDENTITY,
        processInstanceId: PROCESS,
        operations: reads,
      });
      await settle();
      expect(result.current.phase).toBe("stopped");
      expect(result.current.stopReason).toBe(stopReason);

      await act(async () => {
        result.current.checkAgain();
        await Promise.resolve();
      });
      expect(processIds).toHaveLength(2);

      // The stop stands. Reporting "polling" here would promise an automatic
      // retry that `schedule()` refuses to arm, because the monitor is still
      // stopped — a state a consumer would render as "we are checking".
      expect(result.current.phase).toBe("stopped");
      expect(result.current.stopReason).toBe(stopReason);
      // The new failure is still surfaced rather than hidden by the stop.
      expect(result.current.connection).toBe(connection);
      expect(result.current.lastFailure).toEqual(failure);

      // And no timer-driven read follows, matching the reported phase.
      await advance(60_000);
      expect(processIds).toHaveLength(2);
    },
  );

  it("stays manually retryable after a failed recheck and resumes on success", async () => {
    const { reads, processIds } = createReads((call) => {
      if (call === 1) return ok(succeededProcess);
      if (call === 2) return fails(TRANSIENT);
      return ok(runningProcess);
    });

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    await act(async () => {
      result.current.checkAgain();
      await Promise.resolve();
    });
    expect(result.current.phase).toBe("stopped");
    expect(result.current.stopReason).toBe("terminal");

    // A failed recheck does not disable the control.
    await act(async () => {
      result.current.checkAgain();
      await Promise.resolve();
    });
    expect(processIds).toHaveLength(3);

    // Only a successful active snapshot lifts the stop and rearms the timer.
    expect(result.current.phase).toBe("polling");
    expect(result.current.stopReason).toBeUndefined();
    expect(result.current.connection).toBe("fresh");
    expect(result.current.view.processing).toBe("running");

    await advance(5_000);
    expect(processIds).toHaveLength(4);
  });

  it("resumes polling when a recheck after a denial succeeds", async () => {
    const { reads, processIds } = createReads((call) =>
      call === 1
        ? fails({ kind: "forbidden", httpStatus: 403 })
        : ok(runningProcess),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(result.current.phase).toBe("stopped");

    await act(async () => {
      result.current.checkAgain();
      await Promise.resolve();
    });

    expect(result.current.connection).toBe("fresh");
    expect(result.current.phase).toBe("polling");
    await advance(5_000);
    expect(processIds).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Visibility and teardown
// ---------------------------------------------------------------------------

describe("visibility and teardown", () => {
  it("pauses while hidden and reads once on return", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(processIds).toHaveLength(1);

    await setVisibility("hidden");
    expect(result.current.phase).toBe("paused");
    await advance(60_000);
    expect(processIds).toHaveLength(1);

    // Returning reads once immediately, without waiting for the interval.
    await setVisibility("visible");
    await settle();
    expect(processIds).toHaveLength(2);
    expect(result.current.phase).toBe("polling");

    await advance(5_000);
    expect(processIds).toHaveLength(3);
  });

  it("schedules nothing when a read completes while hidden", async () => {
    const slow = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds } = createReads((call) =>
      call === 1 ? slow.promise : ok(runningProcess),
    );

    renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(processIds).toHaveLength(1);

    // The tab is hidden while the read is still outstanding, so its completion
    // is the one moment a poll could be scheduled behind the pause.
    await setVisibility("hidden");
    await act(async () => {
      slow.settle(ok(runningProcess));
      await Promise.resolve();
    });

    await advance(60_000);
    expect(processIds).toHaveLength(1);

    await setVisibility("visible");
    await settle();
    expect(processIds).toHaveLength(2);
  });

  it("does not resume polling on return when the process is terminal", async () => {
    const { reads, processIds } = createReads(() => ok(succeededProcess));

    renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    await setVisibility("hidden");
    await setVisibility("visible");
    await advance(60_000);

    expect(processIds).toHaveLength(1);
  });

  it("aborts and schedules nothing further after unmount", async () => {
    const pending = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds, processSignals } = createReads((call) =>
      call === 1 ? ok(runningProcess) : pending.promise,
    );

    const { unmount } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    await advance(5_000);
    expect(processIds).toHaveLength(2);

    unmount();

    expect(processSignals[1]?.aborted).toBe(true);
    // A transport that ignores the signal still cannot reach a torn-down hook.
    await act(async () => {
      pending.settle(ok(succeededProcess));
      await Promise.resolve();
    });
    await advance(60_000);
    expect(processIds).toHaveLength(2);
  });

  it("leaves no duplicate poller behind under StrictMode", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));

    renderMonitor(
      {
        identity: IDENTITY,
        processInstanceId: PROCESS,
        operations: reads,
      },
      ({ children }) => <StrictMode>{children}</StrictMode>,
    );
    await settle();

    const afterMount = processIds.length;
    expect(afterMount).toBeGreaterThanOrEqual(1);

    // Exactly one read per interval: a second surviving poller would double it.
    await advance(5_000);
    expect(processIds).toHaveLength(afterMount + 1);
    await advance(5_000);
    expect(processIds).toHaveLength(afterMount + 2);
  });

  it("does not restart the poller when unrelated props change", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));
    const props = {
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    };

    const { rerender } = renderMonitor(props);
    await settle();
    expect(processIds).toHaveLength(1);

    // A caller re-creating the identity object on every render is routine.
    for (let index = 0; index < 5; index += 1) {
      rerender({ ...props, identity: { ...IDENTITY } });
    }
    await settle();
    expect(processIds).toHaveLength(1);

    await advance(5_000);
    expect(processIds).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Scope isolation
// ---------------------------------------------------------------------------

describe("scope isolation", () => {
  it("never renders the previous principal's process, not even once", async () => {
    const { reads, processIds } = createReads(() => ok(succeededProcess));
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, renders, rerender } = renderMonitorRecording({
      identity: IDENTITY,
      ...base,
    });
    await settle();
    expect(result.current.view.processing).toBe("succeeded");
    expect(result.current.snapshot).not.toBeNull();
    expect(renders.some((entry) => entry.hasSnapshot)).toBe(true);

    const beforeSwitch = renders.length;
    rerender({ identity: OTHER_IDENTITY, ...base });

    // Renders produced by the scope change itself, before the new principal's
    // own read has resolved. Every one of them is empty: a render carrying the
    // old snapshot would mean the data was cleared by a later effect — one
    // painted frame too late.
    const onSwitch = renders.slice(beforeSwitch);
    expect(onSwitch.length).toBeGreaterThan(0);
    for (const entry of onSwitch) {
      expect(entry.principalId).toBe(OTHER_IDENTITY.principalId);
      expect(entry.hasSnapshot).toBe(false);
      expect(entry.hasConfig).toBe(false);
      expect(entry.processing).toBe("loading");
      expect(entry.datasetId).toBeUndefined();
    }

    // Only then does the new principal's own read land.
    await settle();
    expect(processIds).toHaveLength(2);
    expect(result.current.snapshot).not.toBeNull();
  });

  it("never renders the previous process reference after it changes", async () => {
    const { reads } = createReads(() => ok(runningProcess));
    const base = { identity: IDENTITY, operations: reads };

    const { result, renders, rerender } = renderMonitorRecording({
      processInstanceId: PROCESS,
      ...base,
    });
    await settle();
    expect(result.current.snapshot).not.toBeNull();

    const beforeSwitch = renders.length;
    rerender({ processInstanceId: OTHER_PROCESS, ...base });

    const afterSwitch = renders.slice(beforeSwitch);
    expect(afterSwitch.length).toBeGreaterThan(0);
    for (const entry of afterSwitch) {
      expect(entry.processInstanceId).toBe(OTHER_PROCESS);
      expect(entry.hasSnapshot).toBe(false);
      expect(entry.processing).toBe("loading");
    }
  });

  it("never renders a resolved principal's process once identity is lost", async () => {
    const { reads } = createReads(() => ok(succeededProcess));
    const base = { processInstanceId: PROCESS, operations: reads };

    const { renders, rerender } = renderMonitorRecording({
      identity: IDENTITY,
      ...base,
    });
    await settle();

    const beforeLoss = renders.length;
    rerender({ identity: null, ...base });

    const afterLoss = renders.slice(beforeLoss);
    expect(afterLoss.length).toBeGreaterThan(0);
    for (const entry of afterLoss) {
      expect(entry.hasSnapshot).toBe(false);
      expect(entry.processing).toBe("loading");
    }
  });

  it("isolates a gateway environment switch for the same principal and process", async () => {
    const OTHER_ENVIRONMENT = {
      principalId: IDENTITY.principalId,
      gatewayOrigin: "https://gateway.staging.datagems.example",
    };
    const staleRead = deferred<ReadResult<ProcessSnapshot>>();
    const freshRead = deferred<ReadResult<ProcessSnapshot>>();
    const freshConfig = deferred<ReadResult<OnboardingConfig>>();
    const { reads, processIds, processSignals, configSignals } = createReads(
      (call) => {
        if (call === 1) return ok(runningProcess);
        // Outstanding at the moment the environment changes.
        if (call === 2) return staleRead.promise;
        return freshRead.promise;
      },
      (call) =>
        call === 1
          ? { ok: true, value: configOf(onboardingConfigPayload) }
          : freshConfig.promise,
    );
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, renders, rerender } = renderMonitorRecording({
      identity: IDENTITY,
      ...base,
    });
    await settle();
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.config).not.toBeNull();

    // Leave a read in flight, so the switch has something to abort.
    await advance(5_000);
    expect(processIds).toHaveLength(2);

    // Same principal, same process, different Gateway environment.
    const beforeSwitch = renders.length;
    rerender({ identity: OTHER_ENVIRONMENT, ...base });

    const onSwitch = renders.slice(beforeSwitch);
    expect(onSwitch.length).toBeGreaterThan(0);
    for (const entry of onSwitch) {
      expect(entry.gatewayOrigin).toBe(OTHER_ENVIRONMENT.gatewayOrigin);
      expect(entry.principalId).toBe(IDENTITY.principalId);
      expect(entry.processInstanceId).toBe(PROCESS);
      // No render carries the previous environment's data, not even the first.
      expect(entry.hasSnapshot).toBe(false);
      expect(entry.hasConfig).toBe(false);
      expect(entry.processing).toBe("loading");
      expect(entry.datasetId).toBeUndefined();
    }

    // The obsolete request is aborted, and the new environment is read afresh.
    expect(processSignals[1]?.aborted).toBe(true);
    await settle();
    expect(processIds).toHaveLength(3);
    expect(configSignals).toHaveLength(2);

    // The previous environment answers late, with a transport that ignored its
    // abort signal. It cannot replace the current environment's state.
    await act(async () => {
      staleRead.settle(ok(succeededProcess));
      await Promise.resolve();
    });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.view.processing).toBe("loading");
    expect(result.current.phase).toBe("polling");
    expect(result.current.stopReason).toBeUndefined();

    // Nor does it arm a timer on the old environment's behalf.
    await advance(60_000);
    expect(processIds).toHaveLength(3);

    // The current environment's own read still lands normally.
    await act(async () => {
      freshRead.settle(ok(runningProcess));
      await Promise.resolve();
    });
    expect(result.current.view.processing).toBe("running");
  });

  it("rejects a late response from a superseded identity", async () => {
    const first = deferred<ReadResult<ProcessSnapshot>>();
    const second = deferred<ReadResult<ProcessSnapshot>>();
    // A transport that ignores its abort signal entirely.
    const { reads, processIds } = createReads((call) =>
      call === 1 ? first.promise : second.promise,
    );
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, rerender } = renderMonitor({ identity: IDENTITY, ...base });
    await settle();

    rerender({ identity: OTHER_IDENTITY, ...base });
    await settle();
    expect(processIds).toHaveLength(2);

    // The first principal's read finally answers — and is dropped.
    await act(async () => {
      first.settle(ok(succeededProcess));
      await Promise.resolve();
    });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.view.processing).toBe("loading");

    // The current scope's own read still lands normally.
    await act(async () => {
      second.settle(ok(runningProcess));
      await Promise.resolve();
    });
    expect(result.current.view.processing).toBe("running");
  });

  it("rejects a late response from a superseded generation of the same scope", async () => {
    const firstRead = deferred<ReadResult<ProcessSnapshot>>();
    const firstConfig = deferred<ReadResult<OnboardingConfig>>();
    const { reads, processIds } = createReads(
      (call) => (call === 1 ? firstRead.promise : ok(runningProcess)),
      (call) =>
        call === 1 ? firstConfig.promise : { ok: false, failure: TRANSIENT },
    );
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, rerender } = renderMonitor({ identity: IDENTITY, ...base });
    await settle();
    expect(processIds).toHaveLength(1);

    // Away to another principal and back again. The scope key returns to its
    // original value, so comparing scope keys can no longer tell the first
    // generation's outstanding reads from the current one's — only the
    // per-generation guard can.
    rerender({ identity: OTHER_IDENTITY, ...base });
    await settle();
    rerender({ identity: IDENTITY, ...base });
    await settle();

    expect(processIds).toHaveLength(3);
    expect(result.current.view.processing).toBe("running");
    expect(result.current.config).toBeNull();
    expect(result.current.configurationUnavailable).toBe(true);

    // The abandoned generation finally answers, with a transport that ignored
    // its abort signal. Neither result may land.
    await act(async () => {
      firstRead.settle(ok(succeededProcess));
      firstConfig.settle({
        ok: true,
        value: configOf(onboardingConfigPayload),
      });
      await Promise.resolve();
    });

    expect(result.current.view.processing).toBe("running");
    expect(result.current.phase).toBe("polling");
    expect(result.current.config).toBeNull();
  });

  it("treats a refreshed transport for the same principal as the same scope", async () => {
    const firstReads = createReads(() => ok(runningProcess));
    const secondReads = createReads(() => ok(succeededProcess));
    const base = { identity: IDENTITY, processInstanceId: PROCESS };

    const { result, rerender } = renderMonitor({
      ...base,
      operations: firstReads.reads,
    });
    await settle();
    expect(firstReads.processIds).toHaveLength(1);

    // A token refresh hands over a new operations object for the same user.
    rerender({ ...base, operations: secondReads.reads });

    // Neither a restart nor a reset: what is on screen stays on screen.
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.view.processing).toBe("running");
    await settle();
    expect(secondReads.processIds).toHaveLength(0);

    // The next scheduled read uses the refreshed operations.
    await advance(5_000);
    expect(firstReads.processIds).toHaveLength(1);
    expect(secondReads.processIds).toHaveLength(1);
    expect(result.current.view.processing).toBe("succeeded");
  });
});

// ---------------------------------------------------------------------------
// Manual recheck
// ---------------------------------------------------------------------------

describe("check again", () => {
  it("coalesces with an in-flight read instead of issuing a second call", async () => {
    const slow = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds } = createReads((call) =>
      call === 1 ? slow.promise : ok(runningProcess),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(processIds).toHaveLength(1);

    await act(async () => {
      result.current.checkAgain();
      result.current.checkAgain();
      result.current.checkAgain();
      await Promise.resolve();
    });
    expect(processIds).toHaveLength(1);

    await act(async () => {
      slow.settle(ok(runningProcess));
      await Promise.resolve();
    });
    expect(result.current.view.processing).toBe("running");
    expect(processIds).toHaveLength(1);
  });

  it("reads immediately between polls and restarts the interval", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    await advance(2_000);
    expect(processIds).toHaveLength(1);

    await act(async () => {
      result.current.checkAgain();
      await Promise.resolve();
    });
    expect(processIds).toHaveLength(2);

    // The superseded timer was cleared: the next read is a full interval away.
    await advance(4_999);
    expect(processIds).toHaveLength(2);
    await advance(1);
    expect(processIds).toHaveLength(3);
  });

  it("keeps a stable callback identity across renders", async () => {
    const { reads } = createReads(() => ok(runningProcess));
    const props = {
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    };

    const { result, rerender } = renderMonitor(props);
    await settle();
    const first = result.current.checkAgain;

    rerender({ ...props, identity: { ...IDENTITY } });
    expect(result.current.checkAgain).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe("configuration", () => {
  it("loads configuration once per scope and orders the stages", async () => {
    const { reads, configSignals } = createReads(() => ok(runningProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    await advance(15_000);

    expect(configSignals).toHaveLength(1);
    expect(result.current.view.configurationMatched).toBe(true);
    expect(result.current.view.stages.map((stage) => stage.order)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("keeps the aggregate and keeps polling when configuration fails", async () => {
    const { reads, processIds } = createReads(
      () => ok(runningProcess),
      () => ({ ok: false, failure: TRANSIENT }),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.configurationUnavailable).toBe(true);
    expect(result.current.view.processing).toBe("running");
    expect(result.current.view.aggregateStatus).toEqual({
      kind: "known",
      code: 0,
      name: "InProgress",
    });
    expect(hasNotice(result.current.view, "configuration-unavailable")).toBe(
      true,
    );
    expect(result.current.view.configurationMatched).toBe(false);

    // Status polling is unaffected by a configuration failure.
    await advance(5_000);
    expect(processIds).toHaveLength(2);
  });

  it("keeps a snapshot that arrived before the configuration failed", async () => {
    const lateConfig = deferred<ReadResult<OnboardingConfig>>();
    const { reads } = createReads(
      () => ok(runningProcess),
      () => lateConfig.promise,
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.view.processing).toBe("running");

    await act(async () => {
      lateConfig.settle({ ok: false, failure: TRANSIENT });
      await Promise.resolve();
    });

    // A configuration failure arriving after a valid aggregate must not erase
    // it; it only removes the ordered stage rendering.
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.view.processing).toBe("running");
    expect(result.current.view.aggregateStatus).toEqual({
      kind: "known",
      code: 0,
      name: "InProgress",
    });
    expect(result.current.configurationUnavailable).toBe(true);
    expect(hasNotice(result.current.view, "configuration-unavailable")).toBe(
      true,
    );
  });

  it("retries configuration as a read only, without touching the process", async () => {
    const { reads, processIds, configSignals } = createReads(
      () => ok(runningProcess),
      (call) =>
        call === 1
          ? { ok: false, failure: TRANSIENT }
          : { ok: true, value: configOf(onboardingConfigPayload) },
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(result.current.configurationUnavailable).toBe(true);
    const processCallsBefore = processIds.length;

    await act(async () => {
      result.current.retryConfiguration();
      await Promise.resolve();
    });

    expect(configSignals).toHaveLength(2);
    expect(processIds).toHaveLength(processCallsBefore);
    expect(result.current.configurationUnavailable).toBe(false);
    expect(result.current.view.configurationMatched).toBe(true);
  });

  it("ignores a configuration load that belongs to a superseded scope", async () => {
    const stale = deferred<ReadResult<OnboardingConfig>>();
    const never = deferred<ReadResult<OnboardingConfig>>();
    const { reads } = createReads(
      () => ok(runningProcess),
      (call) => (call === 1 ? stale.promise : never.promise),
    );
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, rerender } = renderMonitor({ identity: IDENTITY, ...base });
    await settle();

    rerender({ identity: OTHER_IDENTITY, ...base });
    await settle();

    await act(async () => {
      stale.settle({ ok: true, value: configOf(onboardingConfigPayload) });
      await Promise.resolve();
    });

    expect(result.current.config).toBeNull();
    expect(result.current.configurationUnavailable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Model semantics and access evidence
// ---------------------------------------------------------------------------

describe("model semantics passed through the hook", () => {
  it("preserves censored step details as unavailable, never as success", async () => {
    const { reads } = createReads(() => ok(stepsAbsentProcess));

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.view.processing).toBe("running");
    expect(result.current.view.stepDetailsAvailable).toBe(false);
    expect(hasNotice(result.current.view, "step-details-unavailable")).toBe(
      true,
    );
    expect(
      result.current.view.stages.every(
        (stage) => stage.state === "not-reported",
      ),
    ).toBe(true);
  });

  it("offers the dataset action only with supplied readability evidence", async () => {
    const { reads } = createReads(() => ok(succeededProcess));
    const base = {
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    };

    const { result, rerender } = renderMonitor(base);
    await settle();

    expect(result.current.view.actions.map((action) => action.code)).toEqual([
      "check-again",
    ]);
    expect(hasNotice(result.current.view, "availability-unconfirmed")).toBe(
      true,
    );

    rerender({
      ...base,
      access: { availability: "readable", sharing: "confirmed" },
    });

    expect(result.current.view.actions.map((action) => action.code)).toEqual([
      "check-again",
      "view-dataset",
    ]);
  });

  it("never reaches a mutation: only the two read operations are called", async () => {
    const { reads, start, processIds, configSignals } = createReads(() =>
      ok(runningProcess),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    await act(async () => {
      result.current.checkAgain();
      result.current.retryConfiguration();
      await Promise.resolve();
    });
    await advance(30_000);

    expect(start).not.toHaveBeenCalled();
    expect(processIds.length).toBeGreaterThan(1);
    expect(configSignals.length).toBeGreaterThan(1);
  });

  it("does not let a throwing read operation escape into a render", async () => {
    const { reads, processIds } = createReads((call) => {
      if (call === 1) throw new Error("transport exploded");
      return ok(runningProcess);
    });

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    expect(result.current.connection).toBe("unavailable");
    expect(result.current.view.processing).toBe("loading");

    // Recovered through the ordinary backoff, not a crash.
    await advance(10_000);
    expect(processIds).toHaveLength(2);
    expect(result.current.view.processing).toBe("running");
  });
});

// ---------------------------------------------------------------------------
// Read activity (presentation evidence only)
// ---------------------------------------------------------------------------

describe("read activity", () => {
  it("is set by an actual read, not by the polling schedule", async () => {
    const slow = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds } = createReads((call) =>
      call === 1 ? slow.promise : ok(runningProcess),
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(processIds).toHaveLength(1);
    expect(result.current.phase).toBe("polling");
    expect(result.current.reading).toBe(true);

    await act(async () => {
      slow.settle(ok(runningProcess));
      await Promise.resolve();
    });
    // Still polling, but waiting for the next scheduled read.
    expect(result.current.phase).toBe("polling");
    expect(result.current.reading).toBe(false);

    await advance(5_000);
    expect(processIds).toHaveLength(2);
    expect(result.current.reading).toBe(false);
  });

  it("covers a manual recheck while stopped, without resuming polling", async () => {
    const recheck = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds } = createReads((call) =>
      call === 1 ? ok(succeededProcess) : recheck.promise,
    );

    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();
    expect(result.current.phase).toBe("stopped");
    expect(result.current.reading).toBe(false);

    await act(async () => {
      result.current.checkAgain();
      result.current.checkAgain();
      await Promise.resolve();
    });
    expect(processIds).toHaveLength(2);
    expect(result.current.reading).toBe(true);

    await act(async () => {
      recheck.settle(fails(TRANSIENT));
      await Promise.resolve();
    });
    expect(result.current.reading).toBe(false);
    expect(result.current.phase).toBe("stopped");
    await advance(60_000);
    expect(processIds).toHaveLength(2);
  });

  it("is not set while paused", async () => {
    const { reads, processIds } = createReads(() => ok(runningProcess));
    const { result } = renderMonitor({
      identity: IDENTITY,
      processInstanceId: PROCESS,
      operations: reads,
    });
    await settle();

    await setVisibility("hidden");
    await advance(30_000);
    expect(processIds).toHaveLength(1);
    expect(result.current.phase).toBe("paused");
    expect(result.current.reading).toBe(false);
  });

  it("does not let a previous scope's late settlement clear the current read", async () => {
    const first = deferred<ReadResult<ProcessSnapshot>>();
    const second = deferred<ReadResult<ProcessSnapshot>>();
    const { reads, processIds } = createReads((call) =>
      call === 1 ? first.promise : second.promise,
    );
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, rerender } = renderMonitor({ identity: IDENTITY, ...base });
    await settle();
    rerender({ identity: OTHER_IDENTITY, ...base });
    await settle();
    expect(processIds).toHaveLength(2);
    expect(result.current.reading).toBe(true);

    await act(async () => {
      first.settle(ok(succeededProcess));
      await Promise.resolve();
    });
    expect(result.current.reading).toBe(true);
    expect(result.current.snapshot).toBeNull();

    await act(async () => {
      second.settle(ok(runningProcess));
      await Promise.resolve();
    });
    expect(result.current.reading).toBe(false);
  });

  it("does not carry a previous scope's in-flight read into an inactive one", async () => {
    const slow = deferred<ReadResult<ProcessSnapshot>>();
    const { reads } = createReads(() => slow.promise);
    const base = { processInstanceId: PROCESS, operations: reads };

    const { result, rerender } = renderMonitor({ identity: IDENTITY, ...base });
    await settle();
    expect(result.current.reading).toBe(true);

    rerender({ identity: null, ...base });
    expect(result.current.reading).toBe(false);
  });
});
