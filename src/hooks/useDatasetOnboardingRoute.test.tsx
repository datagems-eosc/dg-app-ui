import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

import {
  DATASET_ID,
  onboardingConfigPayload,
  PROCESS_INSTANCE_ID,
  runningProcess,
  succeededProcess,
} from "@/lib/datasetOnboarding/fixtures";
import { hasNotice } from "@/lib/datasetOnboarding/model";
import {
  SESSION_RECORD_KEY,
  type SessionStorageLike,
  writeSessionRecord,
} from "@/lib/datasetOnboarding/recovery";
import { asProcessInstanceId } from "@/lib/datasetOnboarding/types";
import {
  type UseDatasetOnboardingRouteInput,
  useDatasetOnboardingRoute,
} from "./useDatasetOnboardingRoute";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// Only the session and `fetch` are mocked. `useApi`, its private
// `makeRequest`, `fetchWithAuth`, the accepted Gateway adapter, the accepted
// monitoring hook and the accepted recovery helper all run for real, so the
// request counts, headers and isolation asserted below are the ones the
// composed controller actually produces.

const API_BASE = "https://gateway.test/dg";
const OTHER_API_BASE = "https://gateway.other.test/dg";

const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";

const OTHER_PROCESS_ID = "8f1d0c92-6b3a-4e77-9a05-1d4e8c7b2f60";

const FEATURE_PATH = `/datasets/onboarding/${PROCESS_INSTANCE_ID}`;

// --- session ---------------------------------------------------------------

interface SessionOptions {
  readonly status?: "loading" | "authenticated" | "unauthenticated";
  readonly accessToken?: string | undefined;
  readonly userId?: unknown;
  readonly error?: string;
}

/** Key presence, not `?? default`, so "no token" can be expressed. */
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

// --- transport -------------------------------------------------------------

type RequestKind = "config" | "process" | "other";

interface Recorded {
  readonly url: string;
  readonly kind: RequestKind;
  readonly method: string;
  readonly authorization: string | null;
}

const kindOf = (url: string): RequestKind => {
  const path = new URL(url).pathname;
  if (path === "/dg/gw/api/workflow-process/config") return "config";
  if (path.startsWith("/dg/gw/api/workflow-process/")) return "process";
  return "other";
};

type Respond = (
  call: number,
  recorded: Recorded,
) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const okConfig = () => json(onboardingConfigPayload);

const createTransport = (respond: Respond) => {
  const calls: Recorded[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const recorded: Recorded = {
        url,
        kind: kindOf(url),
        method: (init?.method ?? "GET").toUpperCase(),
        authorization: new Headers(init?.headers).get("Authorization"),
      };
      calls.push(recorded);
      return respond(calls.length, recorded);
    },
  );
  vi.stubGlobal("fetch", fetchMock);

  const of = (kind: RequestKind) => calls.filter((call) => call.kind === kind);
  return { calls, of };
};

// --- storage ---------------------------------------------------------------

interface StorageOptions {
  readonly throwOnRead?: boolean;
  readonly throwOnWrite?: boolean;
  readonly throwOnRemove?: boolean;
}

const createStorage = (options: StorageOptions = {}) => {
  const entries = new Map<string, string>();
  const removals: string[] = [];

  const storage: SessionStorageLike = {
    getItem: (key) => {
      if (options.throwOnRead) throw new Error("storage blocked");
      return entries.has(key) ? (entries.get(key) as string) : null;
    },
    setItem: (key, value) => {
      if (options.throwOnWrite) throw new Error("storage blocked");
      entries.set(key, value);
    },
    removeItem: (key) => {
      removals.push(key);
      if (options.throwOnRemove) throw new Error("storage blocked");
      entries.delete(key);
    },
  };

  return { storage, entries, removals };
};

const seedRecord = (
  storage: SessionStorageLike,
  overrides: {
    processInstanceId?: string;
    principalId?: string;
    gatewayOrigin?: string;
    sharingNeedsReconciliation?: boolean;
  } = {},
) =>
  writeSessionRecord(storage, {
    processInstanceId: asProcessInstanceId(
      overrides.processInstanceId ?? PROCESS_INSTANCE_ID,
    ),
    scope: {
      principalId: overrides.principalId ?? PRINCIPAL,
      gatewayOrigin: overrides.gatewayOrigin ?? API_BASE,
    },
    sharingNeedsReconciliation: overrides.sharingNeedsReconciliation ?? true,
  });

// --- rendering -------------------------------------------------------------

const renderRoute = (props: UseDatasetOnboardingRouteInput) =>
  renderHook(
    (current: UseDatasetOnboardingRouteInput) =>
      useDatasetOnboardingRoute(current),
    { initialProps: props },
  );

interface RenderRecord {
  readonly status: string;
  readonly auth: string;
  readonly processing: string;
  readonly hasSnapshot: boolean;
  readonly hasConfig: boolean;
  readonly sharingNeedsReconciliation: boolean;
  readonly datasetId?: string;
  readonly principalId: string | null;
}

/**
 * Records what every individual render returned.
 *
 * `rerender` runs inside `act`, so `result.current` afterwards only shows the
 * state once effects have run — which cannot distinguish "cleared during the
 * render that changed scope" from "cleared one render later". The second is
 * what the isolation requirement forbids, so the per-render sequence is what
 * the assertions look at. (Lesson carried over from the accepted 03A tests.)
 */
const renderRouteRecording = (props: UseDatasetOnboardingRouteInput) => {
  const renders: RenderRecord[] = [];
  const harness = renderHook(
    (current: UseDatasetOnboardingRouteInput) => {
      const controller = useDatasetOnboardingRoute(current);
      renders.push({
        status: controller.status,
        auth: controller.auth,
        processing: controller.view.processing,
        hasSnapshot: controller.snapshot !== null,
        hasConfig: controller.config !== null,
        sharingNeedsReconciliation: controller.sharingNeedsReconciliation,
        ...(controller.view.datasetId === undefined
          ? {}
          : { datasetId: controller.view.datasetId }),
        principalId: controller.scope?.principalId ?? null,
      });
      return controller;
    },
    { initialProps: props },
  );
  return { ...harness, renders };
};

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const settle = () => advance(0);

const deferred = <T,>() => {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

const baseProps: UseDatasetOnboardingRouteInput = {
  processInstanceIdParam: PROCESS_INSTANCE_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  window.history.replaceState({}, "", FEATURE_PATH);
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue(session());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Session states
// ---------------------------------------------------------------------------

describe("unusable session", () => {
  it.each([
    ["loading", { status: "loading" as const }, "loading"],
    ["signed out", { status: "unauthenticated" as const }, "unauthenticated"],
    ["a session error", { error: "RefreshAccessTokenError" }, "session-error"],
    ["no access token", { accessToken: undefined }, "credentials-unavailable"],
    ["no user id", { userId: undefined }, "identity-unavailable"],
    ["a blank user id", { userId: "  " }, "identity-unavailable"],
  ])("issues no feature request with %s", async (_label, options, auth) => {
    mockUseSession.mockReturnValue(session(options));
    const { calls } = createTransport(() => okConfig());
    const { storage } = createStorage();
    seedRecord(storage);

    const { result } = renderRoute({ ...baseProps, storage });
    await advance(30_000);

    expect(calls).toHaveLength(0);
    expect(result.current.status).toBe("auth-unavailable");
    expect(result.current.auth).toBe(auth);
    expect(result.current.scope).toBeNull();
    expect(result.current.snapshot).toBeNull();
    expect(result.current.view.processing).toBe("loading");
    expect(result.current.sharingNeedsReconciliation).toBe(false);
  });

  it("hides an already read process the moment identity is lost", async () => {
    const { calls } = createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(runningProcess),
    );
    const { storage } = createStorage();
    seedRecord(storage);

    const { renders, rerender } = renderRouteRecording({
      ...baseProps,
      storage,
    });
    await settle();
    expect(renders.some((entry) => entry.hasSnapshot)).toBe(true);
    const before = calls.length;

    const beforeLoss = renders.length;
    mockUseSession.mockReturnValue(session({ status: "unauthenticated" }));
    await act(async () => {
      rerender({ ...baseProps, storage });
    });
    await advance(30_000);

    const afterLoss = renders.slice(beforeLoss);
    expect(afterLoss.length).toBeGreaterThan(0);
    expect(afterLoss.every((entry) => !entry.hasSnapshot)).toBe(true);
    expect(afterLoss.every((entry) => entry.datasetId === undefined)).toBe(
      true,
    );
    expect(afterLoss.every((entry) => !entry.sharingNeedsReconciliation)).toBe(
      true,
    );
    expect(calls).toHaveLength(before);
  });

  it("clears the stored reference on an explicit sign-out only", async () => {
    createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(runningProcess),
    );

    const loading = createStorage();
    seedRecord(loading.storage);
    mockUseSession.mockReturnValue(session({ status: "loading" }));
    renderRoute({ ...baseProps, storage: loading.storage });
    await settle();
    expect(loading.entries.has(SESSION_RECORD_KEY)).toBe(true);

    const errored = createStorage();
    seedRecord(errored.storage);
    mockUseSession.mockReturnValue(
      session({ error: "RefreshAccessTokenError" }),
    );
    renderRoute({ ...baseProps, storage: errored.storage });
    await settle();
    expect(errored.entries.has(SESSION_RECORD_KEY)).toBe(true);

    const signedOut = createStorage();
    seedRecord(signedOut.storage);
    mockUseSession.mockReturnValue(session({ status: "unauthenticated" }));
    renderRoute({ ...baseProps, storage: signedOut.storage });
    await settle();
    expect(signedOut.entries.has(SESSION_RECORD_KEY)).toBe(false);
  });

  it("survives a store that refuses the sign-out removal", async () => {
    createTransport(() => okConfig());
    const { storage, removals } = createStorage({ throwOnRemove: true });
    seedRecord(storage);
    mockUseSession.mockReturnValue(session({ status: "unauthenticated" }));

    const { result } = renderRoute({ ...baseProps, storage });
    await settle();

    expect(removals).toContain(SESSION_RECORD_KEY);
    expect(result.current.status).toBe("auth-unavailable");
  });
});

// ---------------------------------------------------------------------------
// Credentials and ownership
// ---------------------------------------------------------------------------

describe("token and principal changes", () => {
  it("uses a refreshed token without resetting the monitored process", async () => {
    const { of } = createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(runningProcess),
    );

    const { renders, rerender } = renderRouteRecording(baseProps);
    await settle();
    expect(of("process")).toHaveLength(1);
    expect(of("process")[0].authorization).toBe("Bearer token-1");

    const beforeRefresh = renders.length;
    mockUseSession.mockReturnValue(session({ accessToken: "token-2" }));
    await act(async () => {
      rerender(baseProps);
    });
    await advance(5_000);

    // A new token for the same person changes credentials, not ownership: the
    // next read carries it, and nothing on screen was discarded in between.
    expect(of("process")).toHaveLength(2);
    expect(of("process")[1].authorization).toBe("Bearer token-2");
    expect(
      renders.slice(beforeRefresh).every((entry) => entry.hasSnapshot),
    ).toBe(true);
  });

  it("never renders another principal's process, and rejects its late read", async () => {
    const pending = deferred<Response>();
    const { of } = createTransport((_call, recorded) => {
      if (recorded.kind === "config") return okConfig();
      return of("process").length === 1
        ? pending.promise
        : json(succeededProcess);
    });

    const { renders, rerender } = renderRouteRecording(baseProps);
    await settle();
    expect(of("process")).toHaveLength(1);

    const beforeSwitch = renders.length;
    mockUseSession.mockReturnValue(session({ userId: OTHER_PRINCIPAL }));
    await act(async () => {
      rerender(baseProps);
    });

    // The first principal's read lands after the switch.
    await act(async () => {
      pending.release(json(runningProcess));
      await Promise.resolve();
    });
    await settle();

    const afterSwitch = renders.slice(beforeSwitch);
    expect(
      afterSwitch.every((entry) => entry.principalId === OTHER_PRINCIPAL),
    ).toBe(true);
    const late = afterSwitch.filter((entry) => entry.hasSnapshot);
    // Any snapshot rendered after the switch belongs to the new read, never to
    // the released one — and the new read did render, so this is not vacuous.
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((entry) => entry.processing === "succeeded")).toBe(true);
  });

  it("rejects a late read from a previous environment across a remount", async () => {
    const pending = deferred<Response>();
    const { calls } = createTransport((_call, recorded) => {
      if (recorded.kind === "config") return okConfig();
      return recorded.url.startsWith(API_BASE)
        ? pending.promise
        : json(succeededProcess);
    });

    const first = renderRoute(baseProps);
    await settle();
    expect(calls.some((call) => call.url.startsWith(API_BASE))).toBe(true);

    // The configured base is read once per mount, so an environment change is
    // necessarily a remount. (Hook-level environment switching within one mount
    // is proved in the accepted 4.1 suite.)
    first.unmount();
    window.__env = {
      ...window.__env,
      DATAGEMS_API_BASE_URL: OTHER_API_BASE,
    };

    const second = renderRoute(baseProps);
    await settle();

    await act(async () => {
      pending.release(json(runningProcess));
      await Promise.resolve();
    });
    await settle();

    expect(second.result.current.scope?.gatewayOrigin).toBe(OTHER_API_BASE);
    expect(second.result.current.view.processing).toBe("succeeded");
    expect(
      calls.filter(
        (call) =>
          call.kind === "process" && call.url.startsWith(OTHER_API_BASE),
      ),
    ).not.toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The route reference
// ---------------------------------------------------------------------------

describe("route reference", () => {
  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an empty string", ""],
    ["only whitespace", "   "],
    ["a control character", "\u0000abc"],
    ["a repeated segment", ["a", "b"]],
  ])(
    "refuses %s and never falls back to a stored process",
    async (_label, parameter) => {
      const { calls } = createTransport(() => okConfig());
      const { storage } = createStorage();
      seedRecord(storage);

      const { result } = renderRoute({
        processInstanceIdParam: parameter as never,
        storage,
      });
      await advance(30_000);

      expect(result.current.status).toBe("invalid-reference");
      expect(result.current.reference).toBe("invalid");
      expect(result.current.processInstanceId).toBeNull();
      expect(result.current.sharingNeedsReconciliation).toBe(false);
      // A stored reference is not a substitute for the address bar.
      expect(calls).toHaveLength(0);
    },
  );

  it("monitors a known id from the URL alone, reading only config and process", async () => {
    const { calls, of } = createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(runningProcess),
    );

    const { result } = renderRoute({ ...baseProps, storage: null });
    await settle();

    expect(result.current.status).toBe("monitoring");
    expect(result.current.processInstanceId).toBe(PROCESS_INSTANCE_ID);
    expect(of("config")).toHaveLength(1);
    expect(of("process")).toHaveLength(1);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(of("other")).toHaveLength(0);
    expect(result.current.view.datasetId).toBe(DATASET_ID);
  });

  it("does not decode an already-decoded parameter a second time", async () => {
    const { of } = createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(runningProcess),
    );

    renderRoute({ processInstanceIdParam: "100%25", storage: null });
    await settle();

    // Next has already decoded `100%2525` to `100%25`; the adapter re-encodes
    // it. Decoding again here would request `100%25` and address the wrong
    // process.
    expect(new URL(of("process")[0].url).pathname).toBe(
      "/dg/gw/api/workflow-process/100%2525",
    );
  });

  it("switches processes without carrying the previous one over", async () => {
    const { of } = createTransport((_call, recorded) => {
      if (recorded.kind === "config") return okConfig();
      return recorded.url.includes(PROCESS_INSTANCE_ID)
        ? json(runningProcess)
        : json({ ...succeededProcess, id: OTHER_PROCESS_ID });
    });

    const { renders, rerender } = renderRouteRecording({
      ...baseProps,
      storage: null,
    });
    await settle();
    const beforeSwitch = renders.length;

    await act(async () => {
      rerender({ processInstanceIdParam: OTHER_PROCESS_ID, storage: null });
    });
    await settle();

    const afterSwitch = renders.slice(beforeSwitch);
    // The first process is the only `running` one, so its absence from every
    // render after the switch is what "not carried over" means here.
    expect(afterSwitch.length).toBeGreaterThan(0);
    expect(afterSwitch.every((entry) => entry.processing !== "running")).toBe(
      true,
    );
    expect(afterSwitch.some((entry) => entry.processing === "succeeded")).toBe(
      true,
    );
    expect(of("process")).toHaveLength(2);
    expect(of("process")[1].url).toContain(OTHER_PROCESS_ID);
  });
});

// ---------------------------------------------------------------------------
// Recovery reference
// ---------------------------------------------------------------------------

describe("recovery reference", () => {
  const serveRunning = () =>
    createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(runningProcess),
    );

  it("surfaces a matching record's reconciliation marker", async () => {
    serveRunning();
    const { storage } = createStorage();
    seedRecord(storage, { sharingNeedsReconciliation: true });

    const { result } = renderRoute({ ...baseProps, storage });
    await settle();

    expect(result.current.sharingNeedsReconciliation).toBe(true);
    expect(result.current.status).toBe("monitoring");
  });

  it("reports a matching record that needs nothing as needing nothing", async () => {
    serveRunning();
    const { storage } = createStorage();
    seedRecord(storage, { sharingNeedsReconciliation: false });

    const { result } = renderRoute({ ...baseProps, storage });
    await settle();

    expect(result.current.sharingNeedsReconciliation).toBe(false);
  });

  it.each([
    ["another process", { processInstanceId: OTHER_PROCESS_ID }],
    ["another principal", { principalId: OTHER_PRINCIPAL }],
    ["another environment", { gatewayOrigin: OTHER_API_BASE }],
  ])("refuses a record belonging to %s", async (_label, overrides) => {
    const { of } = serveRunning();
    const { storage } = createStorage();
    seedRecord(storage, { ...overrides, sharingNeedsReconciliation: true });

    const { result } = renderRoute({ ...baseProps, storage });
    await settle();

    expect(result.current.sharingNeedsReconciliation).toBe(false);
    // Refusing the record does not refuse the URL: the process is still read.
    expect(of("process")).toHaveLength(1);
  });

  it("monitors normally when the store throws", async () => {
    const { of } = serveRunning();
    const { storage } = createStorage({ throwOnRead: true });

    const { result } = renderRoute({ ...baseProps, storage });
    await settle();

    expect(result.current.status).toBe("monitoring");
    expect(result.current.view.processing).toBe("running");
    expect(result.current.sharingNeedsReconciliation).toBe(false);
    expect(of("process")).toHaveLength(1);
  });

  it("monitors normally with no store at all", async () => {
    const { of } = serveRunning();

    const { result } = renderRoute({ ...baseProps, storage: null });
    await settle();

    expect(result.current.view.processing).toBe("running");
    expect(of("process")).toHaveLength(1);
  });

  it("writes nothing: no record, no snapshot and no token reach storage", async () => {
    serveRunning();
    const { storage, entries } = createStorage();

    const { result } = renderRoute({ ...baseProps, storage });
    await advance(15_000);

    expect(result.current.view.processing).toBe("running");
    // The controller reads references; writing the accepted-start reference is
    // submission ownership in group 6.
    expect(entries.size).toBe(0);

    const stored = JSON.stringify([...entries.entries()]);
    expect(stored).not.toContain("token-1");
    expect(stored).not.toContain(DATASET_ID);
  });

  it("leaves an existing record byte-identical while monitoring", async () => {
    serveRunning();
    const { storage, entries } = createStorage();
    seedRecord(storage);
    const before = entries.get(SESSION_RECORD_KEY);

    await act(async () => {
      renderRoute({ ...baseProps, storage });
    });
    await advance(15_000);

    expect(entries.get(SESSION_RECORD_KEY)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Failure states and read-only recovery, through the composition
// ---------------------------------------------------------------------------

describe("gateway outcomes through the controller", () => {
  const serve = (processStatus: number) =>
    createTransport((_call, recorded) =>
      recorded.kind === "config"
        ? okConfig()
        : new Response("", { status: processStatus }),
    );

  it("stops on a denial without revealing anything", async () => {
    const { of } = serve(403);
    const { result } = renderRoute({ ...baseProps, storage: null });
    await advance(30_000);

    expect(result.current.connection).toBe("forbidden");
    expect(result.current.phase).toBe("stopped");
    expect(result.current.stopReason).toBe("access-denied");
    expect(result.current.snapshot).toBeNull();
    expect(hasNotice(result.current.view, "connection-forbidden")).toBe(true);
    // A confirmed denial is not polled on a timer.
    expect(of("process")).toHaveLength(1);
  });

  it("stops on an unavailable reference without asserting deletion", async () => {
    const { of } = serve(404);
    const { result } = renderRoute({ ...baseProps, storage: null });
    await advance(30_000);

    expect(result.current.connection).toBe("unavailable");
    expect(result.current.stopReason).toBe("reference-unavailable");
    expect(of("process")).toHaveLength(1);
  });

  it("keeps retrying a transient failure on the agreed backoff", async () => {
    const { of } = serve(503);
    const { result } = renderRoute({ ...baseProps, storage: null });
    await settle();
    expect(of("process")).toHaveLength(1);

    await advance(10_000);
    expect(of("process")).toHaveLength(2);
    expect(result.current.phase).toBe("polling");
    expect(result.current.lastFailure).toEqual({
      kind: "transient",
      httpStatus: 503,
    });
  });

  it("offers a read-only recheck that never mutates", async () => {
    const { calls, of } = createTransport((_call, recorded) =>
      recorded.kind === "config" ? okConfig() : json(succeededProcess),
    );

    const { result } = renderRoute({ ...baseProps, storage: null });
    await settle();
    expect(result.current.phase).toBe("stopped");
    expect(result.current.stopReason).toBe("terminal");
    expect(of("process")).toHaveLength(1);

    await act(async () => {
      result.current.checkAgain();
      await Promise.resolve();
    });
    await settle();

    expect(of("process")).toHaveLength(2);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("retries configuration on its own, without touching the process", async () => {
    let configCalls = 0;
    const { of } = createTransport((_call, recorded) => {
      if (recorded.kind === "config") {
        configCalls += 1;
        return configCalls === 1
          ? new Response("", { status: 503 })
          : okConfig();
      }
      return json(runningProcess);
    });

    const { result } = renderRoute({ ...baseProps, storage: null });
    await settle();
    expect(result.current.configurationUnavailable).toBe(true);
    const processReads = of("process").length;

    await act(async () => {
      result.current.retryConfiguration();
      await Promise.resolve();
    });
    await settle();

    expect(of("config")).toHaveLength(2);
    expect(of("process")).toHaveLength(processReads);
    expect(result.current.config).not.toBeNull();
  });
});
