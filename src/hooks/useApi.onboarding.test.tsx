import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

import {
  DATASET_ID,
  PROCESS_INSTANCE_ID,
  runningProcess,
  startAcceptedBody,
} from "@/lib/datasetOnboarding/fixtures";
import {
  asDatasetId,
  asProcessInstanceId,
  DATA_LOCATION_KIND,
  type OnboardingStartInput,
} from "@/lib/datasetOnboarding/types";
import { useApi } from "./useApi";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// The mocked boundaries are the *session* and `fetch`. Everything between them
// is real: `useApi`'s private `makeRequest`, `fetchWithAuth` and the accepted
// `createOnboardingGateway` adapter all run as they do in the application, so
// the request counts and headers asserted here are the ones the browser would
// actually produce.
//
// "No redirect" is proved the same way as in `lib/utils.auth.test.ts`: the
// private `forceLogoutResponse()` is the only navigating code path and always
// returns a newly constructed 401, so the classification that reaches the
// adapter plus an unchanged `window.location.pathname` distinguish the two.

const FEATURE_PATH = `/datasets/onboarding/${PROCESS_INSTANCE_ID}`;
const API_BASE = "https://gateway.test/dg";

const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";

const PROCESS = asProcessInstanceId(PROCESS_INSTANCE_ID);
const DATASET = asDatasetId(DATASET_ID);

const startInput: OnboardingStartInput = {
  name: "Complex numbers",
  description: "Exercises from the MathE pilot.",
  license: "CC-BY-4.0",
  headline: "Complex numbers exercise set",
  keywords: ["mathematics", "exercises"],
  fieldOfScience: ["mathematics"],
  datePublished: "2026-09-22",
  dataLocations: [
    { kind: DATA_LOCATION_KIND.Staged, location: "staged/abc123" },
  ],
};

interface FetchCall {
  readonly url: string;
  readonly init?: RequestInit;
}

const createFetch = (
  handler: (call: number, url: string, init?: RequestInit) => unknown,
) => {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return handler(calls.length, String(input), init) as Response;
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const unauthorized = (marker: string) =>
  new Response(JSON.stringify({ marker }), {
    status: 401,
    statusText: `gateway-401-${marker}`,
  });

const headerOf = (call: FetchCall | undefined, name: string): string | null =>
  call === undefined ? null : new Headers(call.init?.headers).get(name);

interface SessionOptions {
  readonly status?: "loading" | "authenticated" | "unauthenticated";
  readonly accessToken?: string | undefined;
  readonly userId?: unknown;
  readonly error?: string;
}

/**
 * Key presence, not `?? default`: a test that passes `accessToken: undefined`
 * means "this session has no token", and a default would silently supply one.
 */
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

const renderApi = () => renderHook(() => useApi());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", FEATURE_PATH);
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue(session());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Binding
// ---------------------------------------------------------------------------

describe("the onboarding binding", () => {
  it.each([
    ["loading", { status: "loading" as const }, "loading"],
    ["signed out", { status: "unauthenticated" as const }, "unauthenticated"],
    ["a session error", { error: "RefreshAccessTokenError" }, "session-error"],
    ["no access token", { accessToken: undefined }, "credentials-unavailable"],
    ["no user id", { userId: undefined }, "identity-unavailable"],
    ["a blank user id", { userId: "   " }, "identity-unavailable"],
    ["a non-string user id", { userId: 42 }, "identity-unavailable"],
  ])("resolves no scope with %s", (_label, options, expected) => {
    mockUseSession.mockReturnValue(session(options));
    const { result } = renderApi();

    expect(result.current.datasetOnboarding.auth).toBe(expected);
    expect(result.current.datasetOnboarding.scope).toBeNull();
  });

  it("resolves the principal and the whole configured base as the environment", () => {
    window.__env = {
      ...window.__env,
      DATAGEMS_API_BASE_URL: `${API_BASE}///`,
    };
    const { result } = renderApi();

    expect(result.current.datasetOnboarding.auth).toBe("available");
    expect(result.current.datasetOnboarding.scope).toEqual({
      principalId: PRINCIPAL,
      // The path is preserved; only trailing slashes are normalised, so two
      // deployments differing by path stay two environments.
      gatewayOrigin: API_BASE,
    });
  });

  it("exposes operations rather than credentials", () => {
    const { result } = renderApi();
    const binding = result.current.datasetOnboarding;

    // `readDataset` joined this set in 04B as an additive scoped read. The
    // assertion stays exhaustive on purpose: the binding must never grow a
    // token, a raw request function or a mutation.
    expect(Object.keys(binding).sort()).toEqual([
      "auth",
      "gateway",
      "readDataset",
      "scope",
    ]);
    expect(JSON.stringify(binding.scope)).not.toContain("token-1");
    expect(typeof binding.readDataset).toBe("function");
  });

  it("stays the same member across renders and follows a token refresh", () => {
    const { result, rerender } = renderApi();
    const first = result.current.datasetOnboarding;

    rerender();
    expect(result.current.datasetOnboarding).toBe(first);

    mockUseSession.mockReturnValue(session({ accessToken: "token-2" }));
    rerender();
    // A new transport for the same principal: a different binding object, but
    // the same scope, so consumers keyed on scope do not restart.
    expect(result.current.datasetOnboarding).not.toBe(first);
    expect(result.current.datasetOnboarding.scope).toEqual(first.scope);
  });

  it("refuses an operation without a resolved identity, before reaching fetch", async () => {
    mockUseSession.mockReturnValue(session({ userId: undefined }));
    const { calls } = createFetch(() => json(runningProcess));
    const { result } = renderApi();

    const read =
      await result.current.datasetOnboarding.gateway.getProcess(PROCESS);

    expect(calls).toHaveLength(0);
    expect(read).toEqual({ ok: false, failure: { kind: "transient" } });
  });
});

// ---------------------------------------------------------------------------
// Start — no replay
// ---------------------------------------------------------------------------

describe("onboarding start over the real transport", () => {
  it("sends exactly one request on 401, never refreshes and never redirects", async () => {
    const { calls } = createFetch(() => unauthorized("start"));
    const { result } = renderApi();

    const outcome =
      await result.current.datasetOnboarding.gateway.start(startInput);

    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe("POST");
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(FEATURE_PATH);
    expect(outcome).toEqual({ kind: "rejected", httpStatus: 401 });
  });

  it("keeps 403 uncertain with its forbidden detail, after one request", async () => {
    const { calls } = createFetch(() => new Response("", { status: 403 }));
    const { result } = renderApi();

    const outcome =
      await result.current.datasetOnboarding.gateway.start(startInput);

    expect(calls).toHaveLength(1);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: "unknown",
      failure: { kind: "forbidden", httpStatus: 403 },
    });
  });

  it("keeps an aborted start uncertain without sending anything", async () => {
    const controller = new AbortController();
    controller.abort();
    const { calls } = createFetch(() => json(startAcceptedBody));
    const { result } = renderApi();

    const outcome = await result.current.datasetOnboarding.gateway.start(
      startInput,
      controller.signal,
    );

    expect(calls).toHaveLength(0);
    expect(outcome).toEqual({
      kind: "unknown",
      failure: { kind: "cancelled" },
    });
  });

  it("keeps a lost start uncertain after exactly one request", async () => {
    const { calls } = createFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const { result } = renderApi();

    const outcome =
      await result.current.datasetOnboarding.gateway.start(startInput);

    expect(calls).toHaveLength(1);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: "unknown",
      failure: { kind: "transient" },
    });
  });

  it("puts no policy field into the request options, headers or body", async () => {
    const { calls } = createFetch(() => json(startAcceptedBody));
    const { result } = renderApi();

    await result.current.datasetOnboarding.gateway.start(startInput);

    const sent = calls[0];
    const headers = new Headers(sent.init?.headers);
    const headerNames = [...headers.keys()];
    expect(headerNames).not.toContain("retryon401");
    expect(headerNames).not.toContain("expectedprincipalid");
    expect(headers.get("Authorization")).toBe("Bearer token-1");
    expect(headers.get("oauth2")).toBe("token-1");

    expect(Object.keys(sent.init ?? {}).sort()).toEqual([
      "body",
      "headers",
      "method",
    ]);
    expect(String(sent.init?.body)).not.toContain("retryOn401");
    expect(String(sent.init?.body)).not.toContain("expectedPrincipalId");
    expect(String(sent.init?.body)).not.toContain(PRINCIPAL);
  });
});

// ---------------------------------------------------------------------------
// Reads — one guarded refresh for the same principal
// ---------------------------------------------------------------------------

describe("onboarding reads over the real transport", () => {
  it("refreshes and retries once for the same principal, preserving the request", async () => {
    const { calls } = createFetch((call) =>
      call === 1 ? unauthorized("read") : json(runningProcess),
    );
    mockGetSession.mockResolvedValue({
      accessToken: "token-2",
      user: { id: PRINCIPAL },
    });
    const { result } = renderApi();

    const read =
      await result.current.datasetOnboarding.gateway.getProcess(PROCESS);

    expect(calls).toHaveLength(2);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(headerOf(calls[0], "Authorization")).toBe("Bearer token-1");
    expect(headerOf(calls[1], "Authorization")).toBe("Bearer token-2");
    expect(headerOf(calls[1], "oauth2")).toBe("token-2");
    expect(calls[1].url).toBe(calls[0].url);
    expect(calls[1].init?.method).toBe("GET");
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.datasetId).toBe(DATASET_ID);
  });

  it("builds the path once, with an encoded id and one f= per projected field", async () => {
    const { calls } = createFetch(() => json(runningProcess));
    const { result } = renderApi();

    await result.current.datasetOnboarding.gateway.getProcess(
      asProcessInstanceId("a b/c?d"),
    );

    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe(
      `${API_BASE}/gw/api/workflow-process/a%20b%2Fc%3Fd`,
    );
    expect(calls[0].url.match(/\/gw\/api/g)).toHaveLength(1);
    expect(url.searchParams.getAll("f")).toEqual([
      "id",
      "processId",
      "status",
      "dataset.id",
      "steps.id",
      "steps.stepId",
      "steps.status",
    ]);
  });

  it("forwards the abort signal to the request", async () => {
    const controller = new AbortController();
    const { calls } = createFetch(() => json(runningProcess));
    const { result } = renderApi();

    await result.current.datasetOnboarding.gateway.getProcess(
      PROCESS,
      controller.signal,
    );

    expect(calls[0].init?.signal).toBe(controller.signal);
  });

  it.each([
    ["a different principal", OTHER_PRINCIPAL],
    ["no principal", undefined],
  ])(
    "does not retry or force a logout when the refreshed session has %s",
    async (_label, refreshedId) => {
      const { calls } = createFetch(() => unauthorized("cross"));
      mockGetSession.mockResolvedValue({
        accessToken: "token-2",
        ...(refreshedId === undefined ? {} : { user: { id: refreshedId } }),
      });
      const { result } = renderApi();

      const read =
        await result.current.datasetOnboarding.gateway.getProcess(PROCESS);

      expect(calls).toHaveLength(1);
      expect(window.location.pathname).toBe(FEATURE_PATH);
      expect(read).toEqual({
        ok: false,
        failure: { kind: "unauthorized", httpStatus: 401 },
      });
    },
  );

  it("sends no second request and does not redirect when cancelled during the refresh", async () => {
    const controller = new AbortController();
    const { calls } = createFetch(() => unauthorized("cancelled-refresh"));

    let releaseSession: (value: unknown) => void = () => {};
    mockGetSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSession = resolve;
        }),
    );
    const { result } = renderApi();

    const pending = result.current.datasetOnboarding.gateway.getProcess(
      PROCESS,
      controller.signal,
    );

    await flush();
    expect(calls).toHaveLength(1);
    expect(mockGetSession).toHaveBeenCalledTimes(1);

    controller.abort();
    releaseSession({ accessToken: "token-2", user: { id: PRINCIPAL } });

    const read = await pending;

    expect(calls).toHaveLength(1);
    expect(window.location.pathname).toBe(FEATURE_PATH);
    expect(read).toEqual({ ok: false, failure: { kind: "cancelled" } });
  });

  it("reads configuration through the same prefix without a field set", async () => {
    const { calls } = createFetch(() => json({ version: "1", items: [] }, 503));
    const { result } = renderApi();

    await result.current.datasetOnboarding.gateway.getConfig();

    expect(calls[0].url).toBe(`${API_BASE}/gw/api/workflow-process/config`);
    expect(calls[0].init?.method).toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// Existing consumers — composition regression
// ---------------------------------------------------------------------------
//
// A representative existing read and an existing mutation, exercised through
// the same `useApi` instance, so a change to the shared seam shows up here.
// These record current behaviour; they do not endorse the default replay.

// ---------------------------------------------------------------------------
// Scoped dataset availability (task 5.3)
// ---------------------------------------------------------------------------

describe("the scoped dataset reader over the real transport", () => {
  it("is bound to the same transport, not to a second client", async () => {
    const { result, rerender } = renderApi();
    const first = result.current.datasetOnboarding;
    rerender();

    // Memoised with the binding: a consumer may depend on it directly.
    expect(result.current.datasetOnboarding).toBe(first);
    expect(result.current.datasetOnboarding.readDataset).toBe(
      first.readDataset,
    );
  });

  it("refuses to read without a resolved identity, before reaching fetch", async () => {
    const { calls } = createFetch(() => json({ id: DATASET_ID }));
    mockUseSession.mockReturnValue(session({ userId: undefined }));
    const { result } = renderApi();

    const outcome = await result.current.datasetOnboarding.readDataset(DATASET);

    expect(calls).toHaveLength(0);
    // Never a confirmation, and never a denial we did not hear from anyone.
    expect(outcome).toEqual({ kind: "unknown", reason: "transient" });
  });

  it("builds one prefixed path with an encoded id and both projected fields", async () => {
    const { calls } = createFetch(() => json({ id: "a b/c?d" }));
    const { result } = renderApi();

    await result.current.datasetOnboarding.readDataset(asDatasetId("a b/c?d"));

    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe(
      `${API_BASE}/gw/api/dataset/a%20b%2Fc%3Fd`,
    );
    expect(calls[0].url.match(/\/gw\/api/g)).toHaveLength(1);
    expect(url.searchParams.getAll("f")).toEqual(["id", "name"]);
    expect(calls[0].init?.method).toBe("GET");
    expect(headerOf(calls[0], "Authorization")).toBe("Bearer token-1");
  });

  it("refreshes and retries once for the same principal", async () => {
    const { calls } = createFetch((call) =>
      call === 1 ? unauthorized("access") : json({ id: DATASET_ID, name: "A" }),
    );
    mockGetSession.mockResolvedValue({
      accessToken: "token-2",
      user: { id: PRINCIPAL },
    });
    const { result } = renderApi();

    const outcome = await result.current.datasetOnboarding.readDataset(DATASET);

    expect(calls).toHaveLength(2);
    expect(headerOf(calls[1], "Authorization")).toBe("Bearer token-2");
    expect(outcome).toEqual({
      kind: "readable",
      datasetId: DATASET_ID,
      name: "A",
    });
  });

  it("does not retry or leak a response when the principal changed", async () => {
    const before = window.location.pathname;
    const { calls } = createFetch(() => unauthorized("access-other"));
    // The refreshed session belongs to somebody else.
    mockGetSession.mockResolvedValue({
      accessToken: "token-2",
      user: { id: OTHER_PRINCIPAL },
    });
    const { result } = renderApi();

    const outcome = await result.current.datasetOnboarding.readDataset(DATASET);

    expect(calls).toHaveLength(1);
    expect(outcome).toEqual({ kind: "auth-unusable", httpStatus: 401 });
    // No navigation through this new path either.
    expect(window.location.pathname).toBe(before);
  });

  it("stays cancelled, and does not force a logout, when aborted", async () => {
    const before = window.location.pathname;
    const controller = new AbortController();
    const { calls } = createFetch(async (_call, _url, init) => {
      controller.abort();
      const signal = init?.signal;
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return unauthorized("access-abort");
    });
    const { result } = renderApi();

    const outcome = await result.current.datasetOnboarding.readDataset(
      DATASET,
      controller.signal,
    );

    expect(calls).toHaveLength(1);
    expect(outcome).toEqual({ kind: "cancelled" });
    expect(window.location.pathname).toBe(before);
  });

  it("classifies a refusal without touching any other endpoint", async () => {
    const { calls } = createFetch(() => new Response(null, { status: 403 }));
    const { result } = renderApi();

    const outcome = await result.current.datasetOnboarding.readDataset(DATASET);

    expect(outcome).toEqual({ kind: "denied", httpStatus: 403 });
    expect(calls).toHaveLength(1);
    // No grant, permission, profile or search call follows a refusal.
    expect(calls[0].url).toContain("/gw/api/dataset/");
  });
});

describe("existing useApi consumers are unaffected", () => {
  it("performs a successful read as before", async () => {
    const { calls } = createFetch(() => json({ id: DATASET_ID }));
    const { result } = renderApi();

    await expect(result.current.getDatasetById(DATASET_ID)).resolves.toEqual({
      id: DATASET_ID,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API_BASE}/gw/api/dataset/${DATASET_ID}`);
    expect(headerOf(calls[0], "Authorization")).toBe("Bearer token-1");
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("still refreshes and retries a read once on 401", async () => {
    const { calls } = createFetch((call) =>
      call === 1 ? unauthorized("legacy-read") : json({ id: DATASET_ID }),
    );
    // No `user` at all: the default path must not start requiring one.
    mockGetSession.mockResolvedValue({ accessToken: "token-2" });
    const { result } = renderApi();

    await expect(result.current.getDatasetById(DATASET_ID)).resolves.toEqual({
      id: DATASET_ID,
    });

    expect(calls).toHaveLength(2);
    expect(headerOf(calls[1], "Authorization")).toBe("Bearer token-2");
  });

  it.each([
    ["the refresh yields no token", null],
    [
      "the refresh failed",
      { accessToken: "x", error: "RefreshAccessTokenError" },
    ],
    ["the token is unchanged", { accessToken: "token-1" }],
  ])("still forces a logout when %s", async (_label, refreshed) => {
    const { calls } = createFetch(() => unauthorized("legacy-logout"));
    mockGetSession.mockResolvedValue(refreshed);
    const { result } = renderApi();

    await expect(result.current.getDatasetById(DATASET_ID)).rejects.toThrow();

    expect(calls).toHaveLength(1);
  });

  it("still forces a logout when the retried read is refused again", async () => {
    const { calls } = createFetch(() => unauthorized("legacy-second"));
    mockGetSession.mockResolvedValue({ accessToken: "token-2" });
    const { result } = renderApi();

    await expect(result.current.getDatasetById(DATASET_ID)).rejects.toThrow();

    expect(calls).toHaveLength(2);
  });

  it("still replays an existing mutation on 401 — recorded, not endorsed", async () => {
    const { calls } = createFetch((call) =>
      call === 1 ? unauthorized("legacy-post") : json(DATASET_ID),
    );
    mockGetSession.mockResolvedValue({ accessToken: "token-2" });
    const { result } = renderApi();

    await result.current.profileDataset(DATASET_ID, 0);

    // The existing default is unchanged by this batch. Only the onboarding
    // binding opts out; changing it for every caller needs a backend
    // repeat-safety guarantee that does not exist yet.
    expect(calls).toHaveLength(2);
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[1].init?.method).toBe("POST");
  });
});
