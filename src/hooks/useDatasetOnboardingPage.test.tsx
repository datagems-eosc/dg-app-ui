import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

import { updateStatusOf } from "@/components/DatasetOnboarding/presentation";
import {
  DATASET_ID,
  failedThenPendingProcess,
  onboardingConfigPayload,
  PROCESS_INSTANCE_ID,
  runningProcess,
  succeededProcess,
  succeededWithFailedStepProcess,
} from "@/lib/datasetOnboarding/fixtures";
import { hasAction, hasNotice } from "@/lib/datasetOnboarding/model";
import { SESSION_RECORD_KEY } from "@/lib/datasetOnboarding/recovery";
import { useDatasetOnboardingPage } from "./useDatasetOnboardingPage";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// Only the session and `fetch` are mocked. `useApi`, `fetchWithAuth`, the
// accepted gateway/decoder/model, the accepted route and process hooks and the
// new availability hook all run for real, so the request ledger below is the
// one the browser would produce.

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";

interface SessionOptions {
  readonly status?: "loading" | "authenticated" | "unauthenticated";
  readonly accessToken?: string | undefined;
  readonly userId?: unknown;
  readonly error?: string;
}

const session = (options: SessionOptions = {}) => {
  const status = options.status ?? "authenticated";
  const accessToken =
    "accessToken" in options ? options.accessToken : "token-1";
  const userId = "userId" in options ? options.userId : PRINCIPAL;
  return {
    status,
    data:
      status === "unauthenticated"
        ? null
        : {
            ...(accessToken === undefined ? {} : { accessToken }),
            ...(userId === undefined ? {} : { user: { id: userId } }),
            ...(options.error === undefined ? {} : { error: options.error }),
          },
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

interface Gateway {
  readonly process?: unknown;
  readonly processStatus?: number;
  readonly dataset?: unknown;
  readonly datasetStatus?: number;
}

/** Records every request and answers only the endpoints a test declares. */
const stubGateway = (gateway: Gateway) => {
  const urls: string[] = [];
  const methods: string[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      methods.push((init?.method ?? "GET").toUpperCase());

      if (url.includes("/workflow-process/config")) {
        return json(onboardingConfigPayload);
      }
      if (url.includes("/workflow-process/")) {
        return json(
          gateway.process ?? runningProcess,
          gateway.processStatus ?? 200,
        );
      }
      if (url.includes("/dataset/")) {
        return json(gateway.dataset ?? {}, gateway.datasetStatus ?? 200);
      }
      return json({});
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return {
    urls,
    methods,
    datasetReads: () => urls.filter((u) => u.includes("/gw/api/dataset/")),
    processReads: () =>
      urls.filter(
        (u) =>
          u.includes("/gw/api/workflow-process/") && !u.includes("/config"),
      ),
  };
};

const renderPage = (
  param: string | string[] | undefined = PROCESS_INSTANCE_ID,
) =>
  renderHook(() =>
    useDatasetOnboardingPage({
      processInstanceIdParam: param,
      accessTiming: { retryDelayMs: 50, maxAttempts: 3 },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue(session());
  window.sessionStorage?.clear?.();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe("useDatasetOnboardingPage", () => {
  // --- when a dataset is read at all ---------------------------------------

  it("reads no dataset while the process is still running", async () => {
    const ledger = stubGateway({ process: runningProcess });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("running");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(ledger.processReads().length).toBeGreaterThan(0);
    // Nothing to confirm yet, so nothing is asked.
    expect(ledger.datasetReads()).toHaveLength(0);
    expect(result.current.view.processing).toBe("running");
    expect(hasAction(result.current.view, "view-dataset")).toBe(false);
  });

  it("reads no dataset for a failed process", async () => {
    const ledger = stubGateway({ process: failedThenPendingProcess });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("failed");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(ledger.datasetReads()).toHaveLength(0);
  });

  it("reads no dataset for a contradictory completion", async () => {
    const ledger = stubGateway({ process: succeededWithFailedStepProcess });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("inconsistent");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    // An inconsistent display is not a completion; confirming metadata here
    // would dress a contradiction up as a finished run.
    expect(ledger.datasetReads()).toHaveLength(0);
    expect(hasAction(result.current.view, "view-dataset")).toBe(false);
  });

  // --- completion ----------------------------------------------------------

  it("confirms readability once the process reports completion", async () => {
    const ledger = stubGateway({
      process: succeededProcess,
      dataset: { id: DATASET_ID, name: "Athens air quality 2024" },
    });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("succeeded");
    });
    await waitFor(() => {
      expect(hasAction(result.current.view, "view-dataset")).toBe(true);
    });

    const reads = ledger.datasetReads();
    expect(reads).toHaveLength(1);
    // The id comes from the process, not from a search or a stored reference.
    expect(reads[0]).toContain(`/gw/api/dataset/${DATASET_ID}`);
    expect(reads[0]).toContain("f=id&f=name");
    expect(result.current.datasetTitle).toBe("Athens air quality 2024");
    expect(result.current.view.actions).toContainEqual({
      code: "view-dataset",
      datasetId: DATASET_ID,
    });
    // Only reads, at any point.
    expect(new Set(ledger.methods)).toEqual(new Set(["GET"]));
  });

  it("offers no dataset action and no title when the read is refused", async () => {
    stubGateway({
      process: succeededProcess,
      dataset: {},
      datasetStatus: 403,
    });
    const { result } = renderPage();

    await waitFor(() => {
      expect(hasNotice(result.current.view, "availability-denied")).toBe(true);
    });
    expect(hasAction(result.current.view, "view-dataset")).toBe(false);
    expect(result.current.datasetTitle).toBeUndefined();
    // Processing is still reported as complete; only access is denied.
    expect(result.current.view.processing).toBe("succeeded");
  });

  it("keeps availability unconfirmed when the dataset id does not match", async () => {
    stubGateway({
      process: succeededProcess,
      dataset: { id: "99999999-9999-4999-8999-999999999999", name: "Other" },
    });
    const { result } = renderPage();

    await waitFor(() => {
      expect(hasNotice(result.current.view, "availability-unconfirmed")).toBe(
        true,
      );
    });
    expect(hasAction(result.current.view, "view-dataset")).toBe(false);
    // Never another dataset's name.
    expect(result.current.datasetTitle).toBeUndefined();
  });

  it("invents no sharing task when this flow requested none", async () => {
    // Revision 5: the migrated form applies no grant, so there is nothing
    // outstanding and no recovery record claiming otherwise. The page must not
    // manufacture a warning out of that silence.
    const { result } = (() => {
      stubGateway({
        process: succeededProcess,
        dataset: { id: DATASET_ID, name: "Athens air quality 2024" },
      });
      return renderPage();
    })();

    await waitFor(() => {
      expect(hasAction(result.current.view, "view-dataset")).toBe(true);
    });

    expect(result.current.sharingNeedsReconciliation).toBe(false);
    expect(hasNotice(result.current.view, "sharing-unconfirmed")).toBe(false);
    expect(hasNotice(result.current.view, "sharing-failed")).toBe(false);
    // Readable metadata is still not a grant and not a DMM state: the absent
    // warning buys the caller nothing.
    expect(hasNotice(result.current.view, "dmm-ready-while-incomplete")).toBe(
      false,
    );
  });

  it("keeps an earlier unconfirmed-sharing record honest", async () => {
    window.sessionStorage.setItem(
      SESSION_RECORD_KEY,
      JSON.stringify({
        version: 1,
        processInstanceId: PROCESS_INSTANCE_ID,
        principalId: PRINCIPAL,
        gatewayOrigin: API_BASE,
        recordedAt: "2026-09-22T09:14:07.000Z",
        // Written before revision 5, by a flow that really did request sharing.
        sharingNeedsReconciliation: true,
      }),
    );
    stubGateway({
      process: succeededProcess,
      dataset: { id: DATASET_ID, name: "Athens air quality 2024" },
    });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("succeeded");
    });
    expect(result.current.sharingNeedsReconciliation).toBe(true);
    expect(hasNotice(result.current.view, "sharing-unconfirmed")).toBe(true);
    // The record is read, never rewritten to claim the request never happened.
    expect(
      JSON.parse(window.sessionStorage.getItem(SESSION_RECORD_KEY) as string)
        .sharingNeedsReconciliation,
    ).toBe(true);
  });

  it("shows no earlier-sharing warning for a foreign record", async () => {
    window.sessionStorage.setItem(
      SESSION_RECORD_KEY,
      JSON.stringify({
        version: 1,
        processInstanceId: PROCESS_INSTANCE_ID,
        principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
        gatewayOrigin: API_BASE,
        recordedAt: "2026-09-22T09:14:07.000Z",
        sharingNeedsReconciliation: true,
      }),
    );
    stubGateway({ process: succeededProcess });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("succeeded");
    });
    expect(result.current.sharingNeedsReconciliation).toBe(false);
    expect(hasNotice(result.current.view, "sharing-unconfirmed")).toBe(false);
  });

  // --- read health mapping -------------------------------------------------

  it("treats a loading session as checking, not as a sign-in prompt", () => {
    stubGateway({});
    mockUseSession.mockReturnValue(session({ status: "loading" }));
    const { result } = renderPage();

    expect(result.current.read.session).toBe("available");
    expect(result.current.view.processing).toBe("loading");
  });

  it.each([
    ["signed out", { status: "unauthenticated" as const }],
    ["a session error", { error: "RefreshAccessTokenError" }],
    ["no token", { accessToken: undefined }],
    ["no identity", { userId: undefined }],
  ])(
    "reports %s as an unusable session and reads nothing",
    async (_l, options) => {
      const ledger = stubGateway({});
      mockUseSession.mockReturnValue(session(options));
      const { result } = renderPage();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.read.session).toBe("unavailable");
      expect(ledger.processReads()).toHaveLength(0);
      expect(ledger.datasetReads()).toHaveLength(0);
      expect(result.current.datasetTitle).toBeUndefined();
    },
  );

  it("does not present a stopped unauthorized monitor as healthy", async () => {
    stubGateway({ process: {}, processStatus: 403 });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.read.failure?.kind).toBe("forbidden");
    });

    // The session itself resolved, but that does not make the read healthy.
    expect(result.current.read.session).toBe("available");
    expect(result.current.read.phase).toBe("stopped");
    expect(result.current.controller.auth).toBe("available");
  });

  it("marks an unusable route reference without reading a process", async () => {
    const ledger = stubGateway({});
    const { result } = renderPage(["a", "b"]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.read.reference).toBe("invalid");
    expect(ledger.processReads()).toHaveLength(0);
    expect(ledger.datasetReads()).toHaveLength(0);
  });

  // --- manual recheck ------------------------------------------------------

  it("rechecks status and dataset access together, as separate reads", async () => {
    const ledger = stubGateway({
      process: succeededProcess,
      dataset: { id: DATASET_ID },
    });
    const { result } = renderPage();

    await waitFor(() => {
      expect(hasAction(result.current.view, "view-dataset")).toBe(true);
    });
    const processBefore = ledger.processReads().length;
    const datasetBefore = ledger.datasetReads().length;

    await act(async () => {
      result.current.checkAgain();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(ledger.processReads().length).toBeGreaterThan(processBefore);
    expect(ledger.datasetReads().length).toBeGreaterThan(datasetBefore);
    expect(new Set(ledger.methods)).toEqual(new Set(["GET"]));
  });

  it("still reads the dataset automatically on completion after check again was pressed while running", async () => {
    // Fake timers so the poller's next read can be brought forward; every
    // request below still travels through the real transport and ledger.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mutable on purpose: the stub reads these at call time, so the process
    // can complete and the dataset become resolvable between polls.
    const gateway: {
      process: unknown;
      dataset: unknown;
      datasetStatus: number;
    } = { process: runningProcess, dataset: {}, datasetStatus: 404 };
    const ledger = stubGateway(gateway);
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("running");
    });
    expect(ledger.datasetReads()).toHaveLength(0);

    // The user asks while the run is still going: one manual dataset read,
    // which the Gateway cannot yet resolve.
    await act(async () => {
      result.current.checkAgain();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(ledger.datasetReads()).toHaveLength(1);
    expect(result.current.view.processing).toBe("running");
    expect(hasAction(result.current.view, "view-dataset")).toBe(false);

    // The next poll observes completion, and the dataset now resolves.
    gateway.process = succeededProcess;
    gateway.dataset = { id: DATASET_ID, name: "Athens air quality 2024" };
    gateway.datasetStatus = 200;
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await waitFor(() => {
      expect(result.current.view.processing).toBe("succeeded");
    });
    await waitFor(() => {
      expect(hasAction(result.current.view, "view-dataset")).toBe(true);
    });

    // Exactly one further dataset read, with nobody pressing anything: the
    // automatic confirmation the earlier manual read must not have consumed.
    expect(ledger.datasetReads()).toHaveLength(2);
    expect(result.current.datasetTitle).toBe("Athens air quality 2024");
    expect(new Set(ledger.methods)).toEqual(new Set(["GET"]));
  });

  it("keeps configuration retry separate from the status read", async () => {
    stubGateway({ process: runningProcess });
    const { result } = renderPage();

    await waitFor(() => {
      expect(result.current.view.processing).toBe("running");
    });
    expect(typeof result.current.retryConfiguration).toBe("function");
    expect(result.current.retryConfiguration).toBe(
      result.current.controller.retryConfiguration,
    );
    expect(result.current.checkAgain).not.toBe(
      result.current.controller.checkAgain,
    );
  });

  // --- read activity -------------------------------------------------------

  it("keeps Updating until both overlapping reads settle", async () => {
    // Every process and dataset response is held until the test releases it,
    // so the flags can be observed between dispatch and settlement.
    const held: { url: string; release: () => void }[] = [];
    const answer = (url: string): Response => {
      if (url.includes("/workflow-process/config")) {
        return json(onboardingConfigPayload);
      }
      if (url.includes("/workflow-process/")) return json(succeededProcess);
      return json({ id: DATASET_ID });
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/config")) return answer(url);
        return new Promise<Response>((resolve) => {
          held.push({ url, release: () => resolve(answer(url)) });
        });
      }),
    );
    const release = async (kind: "process" | "dataset") => {
      const index = held.findIndex((entry) =>
        kind === "process"
          ? entry.url.includes("/workflow-process/")
          : entry.url.includes("/gw/api/dataset/"),
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const [entry] = held.splice(index, 1);
      await act(async () => {
        entry?.release();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    const { result } = renderPage();
    await waitFor(() => {
      expect(result.current.read.reading).toBe(true);
    });
    await release("process");
    await waitFor(() => {
      expect(result.current.view.processing).toBe("succeeded");
    });
    // Completion starts the automatic access read; the monitor has stopped.
    await waitFor(() => {
      expect(result.current.read.checkingAccess).toBe(true);
    });
    expect(result.current.read.reading).toBe(false);
    expect(result.current.read.phase).toBe("stopped");
    await release("dataset");
    await waitFor(() => {
      expect(result.current.read.checkingAccess).toBe(false);
    });

    // One Refresh status: two separate reads, both in flight at once.
    act(() => {
      result.current.checkAgain();
    });
    await waitFor(() => {
      expect(result.current.read.reading).toBe(true);
      expect(result.current.read.checkingAccess).toBe(true);
    });
    expect(updateStatusOf(result.current.read, false)).toBe("updating");

    await release("process");
    await waitFor(() => {
      expect(result.current.read.reading).toBe(false);
    });
    // The access read is still running, so the page is still updating.
    expect(result.current.read.checkingAccess).toBe(true);
    expect(updateStatusOf(result.current.read, false)).toBe("updating");

    await release("dataset");
    await waitFor(() => {
      expect(result.current.read.checkingAccess).toBe(false);
    });
    // A normal completion says nothing further about updates.
    expect(updateStatusOf(result.current.read, false)).toBe("none");
    expect(held).toHaveLength(0);
  });
});
