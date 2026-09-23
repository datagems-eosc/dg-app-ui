import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetAccessOutcome } from "@/lib/datasetOnboarding/access";
import {
  DATASET_ID,
  PROCESS_INSTANCE_ID,
} from "@/lib/datasetOnboarding/fixtures";
import {
  asDatasetId,
  asProcessInstanceId,
  type DatasetId,
} from "@/lib/datasetOnboarding/types";
import {
  type OnboardingAccessScope,
  useDatasetOnboardingAccess,
} from "./useDatasetOnboardingAccess";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// Timers are controlled and every read is deferred, so each assertion is about
// ordering and lifetime rather than about how fast a machine happens to be.

const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";
const ORIGIN = "https://gateway.test/dg";
const OTHER_ORIGIN = "https://gateway.other/dg";
const PROCESS = asProcessInstanceId(PROCESS_INSTANCE_ID);
const DATASET = asDatasetId(DATASET_ID);
const OTHER_DATASET = asDatasetId("11111111-2222-3333-4444-555555555555");

const READABLE: DatasetAccessOutcome = {
  kind: "readable",
  datasetId: DATASET,
  name: "Athens air quality 2024",
};

const scopeOf = (
  overrides: Partial<OnboardingAccessScope> = {},
): OnboardingAccessScope => ({
  principalId: PRINCIPAL,
  gatewayOrigin: ORIGIN,
  processInstanceId: PROCESS,
  datasetId: DATASET,
  ...overrides,
});

interface Deferred {
  readonly promise: Promise<DatasetAccessOutcome>;
  readonly settle: (outcome: DatasetAccessOutcome) => void;
  readonly datasetId: DatasetId;
  readonly signal?: AbortSignal;
}

/** A reader whose every call is held open until the test releases it. */
const deferredReader = () => {
  const pending: Deferred[] = [];
  const read = vi.fn(
    (datasetId: DatasetId, signal?: AbortSignal) =>
      new Promise<DatasetAccessOutcome>((resolve) => {
        pending.push({
          promise: undefined as never,
          settle: resolve,
          datasetId,
          ...(signal === undefined ? {} : { signal }),
        });
      }),
  );
  return { read, pending };
};

const TIMING = { retryDelayMs: 5_000, maxAttempts: 3 };

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "visibilityState", {
    value: hidden ? "hidden" : "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const renderAccess = (props: {
  scope?: OnboardingAccessScope | null;
  read: (
    datasetId: DatasetId,
    signal?: AbortSignal,
  ) => Promise<DatasetAccessOutcome>;
  automatic?: boolean;
}) =>
  renderHook(
    ({ scope, read, automatic }) =>
      useDatasetOnboardingAccess({
        scope,
        readDataset: read,
        automatic,
        timing: TIMING,
      }),
    {
      initialProps: {
        scope: props.scope === undefined ? scopeOf() : props.scope,
        read: props.read,
        automatic: props.automatic ?? true,
      },
    },
  );

// ---------------------------------------------------------------------------

describe("useDatasetOnboardingAccess", () => {
  // --- when it reads at all ------------------------------------------------

  it("reads nothing without a resolved scope", async () => {
    const { read } = deferredReader();
    const { result } = renderAccess({ scope: null, read });

    await act(async () => {});
    expect(read).not.toHaveBeenCalled();
    expect(result.current.availability).toBe("unknown");
    expect(result.current.datasetName).toBeUndefined();
  });

  it.each([
    ["a blank principal", { principalId: "  " }],
    ["a blank environment", { gatewayOrigin: "" }],
  ])("reads nothing with %s", async (_label, overrides) => {
    const { read } = deferredReader();
    renderAccess({ scope: scopeOf(overrides), read });
    await act(async () => {});
    expect(read).not.toHaveBeenCalled();
  });

  it("does not check automatically before the process reports completion", async () => {
    const { read } = deferredReader();
    renderAccess({ read, automatic: false });
    await act(async () => {});
    expect(read).not.toHaveBeenCalled();
  });

  it("checks immediately once completion is reported", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read, automatic: false });

    await act(async () => {});
    expect(read).not.toHaveBeenCalled();

    // The page flips this when the aggregate reaches Succeeded.
    view.rerender({ scope: scopeOf(), read, automatic: true });
    await act(async () => {});

    expect(read).toHaveBeenCalledTimes(1);
    // Read by the id the process reported, not a stored or searched one.
    expect(pending[0]?.datasetId).toBe(DATASET);

    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    expect(view.result.current.availability).toBe("readable");
  });

  it("does not check again when an equivalent poll leaves completion set", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    expect(read).toHaveBeenCalledTimes(1);

    for (let poll = 0; poll < 4; poll += 1) {
      view.rerender({ scope: scopeOf(), read, automatic: true });
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
    }
    expect(read).toHaveBeenCalledTimes(1);
    expect(view.result.current.availability).toBe("readable");
  });

  // --- outcomes ------------------------------------------------------------

  it("confirms readability and the name from the matching read", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle(READABLE);
    });

    expect(result.current.availability).toBe("readable");
    expect(result.current.datasetName).toBe("Athens air quality 2024");
    expect(result.current.automaticStopped).toBe(true);
  });

  it("stops immediately on a refusal and reports denial", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({ kind: "denied", httpStatus: 403 });
    });

    expect(result.current.availability).toBe("denied");
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("stops on an unusable session without calling the dataset denied", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({ kind: "auth-unusable", httpStatus: 401 });
    });

    // A 401 says something about the session, not about this dataset.
    expect(result.current.availability).toBe("unknown");
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("stops automatic checking on a malformed answer and stays unknown", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({
        kind: "unknown",
        reason: "malformed",
        httpStatus: 200,
      });
    });

    expect(result.current.availability).toBe("unknown");
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  // --- the budget ----------------------------------------------------------

  it("retries an unresolved reference at most twice, five seconds apart", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(read).toHaveBeenCalledTimes(1);

    // Nothing happens before the delay elapses.
    await act(async () => {
      vi.advanceTimersByTime(4_999);
    });
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(read).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending[1]?.settle({ kind: "unknown", reason: "transient" });
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(read).toHaveBeenCalledTimes(3);

    await act(async () => {
      pending[2]?.settle({ kind: "unavailable", httpStatus: 404 });
    });

    // Three is the whole budget.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.attemptsUsed).toBe(3);
    expect(result.current.automaticStopped).toBe(true);
    expect(result.current.availability).toBe("unknown");
  });

  it("does not restart an exhausted budget on an equivalent re-render", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        pending[attempt]?.settle({ kind: "unavailable", httpStatus: 404 });
      });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
    }
    expect(read).toHaveBeenCalledTimes(3);

    // A poll that changes nothing about the scope hands back a new object.
    for (let poll = 0; poll < 3; poll += 1) {
      view.rerender({ scope: scopeOf(), read, automatic: true });
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
    }

    expect(read).toHaveBeenCalledTimes(3);
  });

  // --- manual --------------------------------------------------------------

  it("reads on request before completion without starting a cycle", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read, automatic: false });

    await act(async () => {});
    expect(read).not.toHaveBeenCalled();

    await act(async () => {
      result.current.checkNow();
    });
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0]?.settle({ kind: "unavailable", httpStatus: 404 });
    });

    // A manual read answers once; it does not schedule its own retries.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("coalesces a manual request with a read already in flight", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {});
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.checkNow();
      result.current.checkNow();
      result.current.checkNow();
    });
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("removes a confirmed answer and its name when a later read fails", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read, automatic: false });

    await act(async () => {
      result.current.checkNow();
    });
    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    expect(result.current.availability).toBe("readable");
    expect(result.current.datasetName).toBe("Athens air quality 2024");

    await act(async () => {
      result.current.checkNow();
    });
    await act(async () => {
      pending[1]?.settle({ kind: "denied", httpStatus: 403 });
    });

    // The action a confirmed read unlocks must not outlive its evidence.
    expect(result.current.availability).toBe("denied");
    expect(result.current.datasetName).toBeUndefined();
  });

  // --- manual reads and the automatic budget (ON-V1 R1) --------------------
  //
  // The approach separates the two: the automatic cycle is "immediate read on
  // completion, then at most two retries"; a manual read is one read, allowed
  // earlier, that neither spends nor ends that cycle. These cases hold the
  // hook to that rule.

  it("keeps the whole automatic cycle after manual reads before completion", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read, automatic: false });

    // The user asks three times while the process is still running.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        view.result.current.checkNow();
      });
      await act(async () => {
        pending[i]?.settle({ kind: "unavailable", httpStatus: 404 });
      });
    }
    expect(read).toHaveBeenCalledTimes(3);
    // Answered, but nothing of the automatic budget was spent.
    expect(view.result.current.attemptsUsed).toBe(0);
    expect(view.result.current.automaticStopped).toBe(false);

    // Completion: the immediate automatic read still happens...
    view.rerender({ scope: scopeOf(), read, automatic: true });
    await act(async () => {});
    expect(read).toHaveBeenCalledTimes(4);
    expect(pending[3]?.datasetId).toBe(DATASET);

    // ...and so do both retries, on the ordinary cadence.
    await act(async () => {
      pending[3]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(view.result.current.attemptsUsed).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(read).toHaveBeenCalledTimes(5);
    await act(async () => {
      pending[4]?.settle({ kind: "unknown", reason: "transient" });
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(read).toHaveBeenCalledTimes(6);
    await act(async () => {
      pending[5]?.settle({ kind: "unavailable", httpStatus: 404 });
    });

    // Three automatic reads is still the whole budget.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(6);
    expect(view.result.current.attemptsUsed).toBe(3);
    expect(view.result.current.automaticStopped).toBe(true);
  });

  it.each([
    ["a refusal", { kind: "denied", httpStatus: 403 }, "denied"],
    [
      "an unusable session",
      { kind: "auth-unusable", httpStatus: 401 },
      "unknown",
    ],
    [
      "a malformed body",
      { kind: "unknown", reason: "malformed", httpStatus: 200 },
      "unknown",
    ],
  ] satisfies ReadonlyArray<
    readonly [string, DatasetAccessOutcome, "denied" | "unknown"]
  >)(
    "still reads automatically on completion after a manual read answered %s",
    async (_label, outcome, availability) => {
      const { read, pending } = deferredReader();
      const view = renderAccess({ read, automatic: false });

      await act(async () => {
        view.result.current.checkNow();
      });
      await act(async () => {
        pending[0]?.settle(outcome);
      });
      expect(view.result.current.availability).toBe(availability);
      // An answer that would end the automatic cycle cannot end one that has
      // not begun.
      expect(view.result.current.automaticStopped).toBe(false);
      expect(view.result.current.attemptsUsed).toBe(0);

      view.rerender({ scope: scopeOf(), read, automatic: true });
      await act(async () => {});
      expect(read).toHaveBeenCalledTimes(2);

      await act(async () => {
        pending[1]?.settle(READABLE);
      });
      expect(view.result.current.availability).toBe("readable");
      expect(view.result.current.datasetName).toBe("Athens air quality 2024");
      expect(view.result.current.attemptsUsed).toBe(1);
      expect(view.result.current.automaticStopped).toBe(true);
    },
  );

  it("does not let a manual read between retries spend or stop the budget", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(result.current.attemptsUsed).toBe(1);

    // A manual read inside the retry window, refused.
    await act(async () => {
      result.current.checkNow();
    });
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending[1]?.settle({ kind: "denied", httpStatus: 403 });
    });
    // It updated what we believe, and nothing else.
    expect(result.current.availability).toBe("denied");
    expect(result.current.attemptsUsed).toBe(1);
    expect(result.current.automaticStopped).toBe(false);

    // Both remaining retries still run on time.
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(read).toHaveBeenCalledTimes(3);
    await act(async () => {
      pending[2]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(read).toHaveBeenCalledTimes(4);
    await act(async () => {
      pending[3]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(result.current.attemptsUsed).toBe(3);
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("does not lose a retry that falls due while a manual read is in flight", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(result.current.attemptsUsed).toBe(1);

    // A manual read is opened and left unanswered across the retry moment.
    await act(async () => {
      result.current.checkNow();
    });
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    // Still no overlapping request...
    expect(read).toHaveBeenCalledTimes(2);

    // ...and the retry runs the moment the transport is free.
    await act(async () => {
      pending[1]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.attemptsUsed).toBe(1);

    await act(async () => {
      pending[2]?.settle(READABLE);
    });
    expect(result.current.availability).toBe("readable");
    expect(result.current.attemptsUsed).toBe(2);
    expect(result.current.automaticStopped).toBe(true);
  });

  it("still reads on request after the budget is spent, without reviving the cycle", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        pending[attempt]?.settle({ kind: "unavailable", httpStatus: 404 });
      });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
    }
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      result.current.checkNow();
    });
    expect(read).toHaveBeenCalledTimes(4);
    await act(async () => {
      pending[3]?.settle(READABLE);
    });
    expect(result.current.availability).toBe("readable");
    expect(result.current.datasetName).toBe("Athens air quality 2024");
    // The automatic cycle is still over; the manual read did not reopen it.
    expect(result.current.attemptsUsed).toBe(3);
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(4);
  });

  // --- scope lifetime ------------------------------------------------------

  it("hides a confirmed answer on the render the principal changes", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    expect(view.result.current.availability).toBe("readable");

    // Synchronous: no effect runs between this render and the assertion.
    view.rerender({
      scope: scopeOf({ principalId: OTHER_PRINCIPAL }),
      read,
      automatic: true,
    });
    expect(view.result.current.availability).toBe("unknown");
    expect(view.result.current.datasetName).toBeUndefined();
  });

  it.each([
    ["the environment", { gatewayOrigin: OTHER_ORIGIN }],
    [
      "the process",
      { processInstanceId: asProcessInstanceId("other-process") },
    ],
    ["the dataset", { datasetId: OTHER_DATASET }],
  ])("hides a confirmed answer when %s changes", async (_label, overrides) => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    expect(view.result.current.availability).toBe("readable");

    view.rerender({ scope: scopeOf(overrides), read, automatic: true });
    expect(view.result.current.availability).toBe("unknown");
    expect(view.result.current.datasetName).toBeUndefined();
  });

  it("aborts the outstanding read when the scope changes", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {});
    expect(pending[0]?.signal?.aborted).toBe(false);

    view.rerender({
      scope: scopeOf({ principalId: OTHER_PRINCIPAL }),
      read,
      automatic: true,
    });
    expect(pending[0]?.signal?.aborted).toBe(true);
  });

  it("rejects a late body that belongs to a scope we have left", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {});
    view.rerender({
      scope: scopeOf({ principalId: OTHER_PRINCIPAL }),
      read,
      automatic: true,
    });

    // The first principal's transport ignored the abort and answered anyway.
    await act(async () => {
      pending[0]?.settle(READABLE);
    });

    expect(view.result.current.availability).toBe("unknown");
    expect(view.result.current.datasetName).toBeUndefined();
  });

  it("does not let an A to B to A round trip resurrect the first answer", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {}); // read 1, scope A
    view.rerender({
      scope: scopeOf({ principalId: OTHER_PRINCIPAL }),
      read,
      automatic: true,
    });
    await act(async () => {}); // read 2, scope B
    view.rerender({ scope: scopeOf(), read, automatic: true });
    await act(async () => {}); // read 3, scope A again

    // The original scope-A response arrives last, after two scope changes.
    await act(async () => {
      pending[0]?.settle({
        kind: "readable",
        datasetId: DATASET,
        name: "Stale",
      });
    });
    expect(view.result.current.datasetName).toBeUndefined();

    // Only the read belonging to the current generation may commit.
    await act(async () => {
      pending[2]?.settle(READABLE);
    });
    expect(view.result.current.availability).toBe("readable");
    expect(view.result.current.datasetName).toBe("Athens air quality 2024");
  });

  it("aborts and stops on unmount", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {});
    view.unmount();

    expect(pending[0]?.signal?.aborted).toBe(true);
    await act(async () => {
      pending[0]?.settle(READABLE);
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  // --- visibility ----------------------------------------------------------

  it("does not schedule background reads while the page is hidden", async () => {
    const { read, pending } = deferredReader();
    renderAccess({ read });

    await act(async () => {
      pending[0]?.settle({ kind: "unavailable", httpStatus: 404 });
    });
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      setHidden(true);
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      setHidden(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("resumes on the same budget rather than a fresh one", async () => {
    const { read, pending } = deferredReader();
    const { result } = renderAccess({ read });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        pending[attempt]?.settle({ kind: "unavailable", httpStatus: 404 });
      });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
    }
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.automaticStopped).toBe(true);

    await act(async () => {
      setHidden(true);
    });
    await act(async () => {
      setHidden(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    // Coming back to the tab is not a reason to start over.
    expect(read).toHaveBeenCalledTimes(3);
  });

  // --- no duplication ------------------------------------------------------

  it("never runs two reads at once", async () => {
    const { read, pending } = deferredReader();
    const view = renderAccess({ read });

    await act(async () => {});
    expect(read).toHaveBeenCalledTimes(1);

    // Re-renders, timer pressure and manual requests, all while one is open.
    for (let i = 0; i < 5; i += 1) {
      view.rerender({ scope: scopeOf(), read, automatic: true });
      await act(async () => {
        view.result.current.checkNow();
        vi.advanceTimersByTime(10_000);
      });
    }
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0]?.settle(READABLE);
    });
    await waitFor(() => {
      expect(view.result.current.availability).toBe("readable");
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
