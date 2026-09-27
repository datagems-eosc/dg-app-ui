import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("next-auth/react", () => ({
  getSession: () => mockGetSession(),
}));

import { type AuthRetryPolicy, fetchWithAuth } from "./utils";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// `fetch` is the mocked boundary and nothing else is: these tests exercise the
// real `fetchWithAuth`, so every assertion below is about the actual number of
// requests it issues and the actual headers it sends.
//
// **How "no redirect" is proved.** `window.location.href` is a non-configurable
// accessor in jsdom, so the assignment itself cannot be spied on. It does not
// need to be: the single private `forceLogoutResponse()` is the only place in
// the module that navigates, and it always returns a *newly constructed*
// `Response(null, { status: 401, statusText: "Unauthorized" })`. So
// `expect(result).toBe(original)` proves that function was never entered —
// no navigation, no synthetic response — and `expect(result).not.toBe(original)`
// with that exact shape proves it was. Each original 401 below therefore
// carries a distinguishing `statusText` and a body.

const FEATURE_PATH =
  "/datasets/onboarding/8f1d0c92-6b3a-4e77-9a05-1d4e8c7b2f60";
const URL_UNDER_TEST = "https://gateway.test/gw/api/workflow-process/p-1";

const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";

/** A 401 that can be recognised again by identity and by shape. */
const unauthorized = (marker: string): Response =>
  new Response(JSON.stringify({ marker }), {
    status: 401,
    statusText: `gateway-401-${marker}`,
  });

const expectForcedLogout = (response: Response, original: Response) => {
  expect(response).not.toBe(original);
  expect(response.status).toBe(401);
  expect(response.statusText).toBe("Unauthorized");
};

interface FetchCall {
  readonly input: RequestInfo | URL;
  readonly init?: RequestInit;
}

const createFetch = (
  handler: (
    call: number,
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => unknown,
) => {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return handler(calls.length, input, init) as Response;
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
};

const headerOf = (call: FetchCall | undefined, name: string): string | null =>
  call === undefined ? null : new Headers(call.init?.headers).get(name);

/** Lets already-resolved promises settle without touching the clock. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const BEARER_INIT: RequestInit = {
  method: "GET",
  headers: { Authorization: "Bearer old-token", oauth2: "old-token" },
};

beforeEach(() => {
  vi.clearAllMocks();
  // A real feature path, not the logout path: the redirect branch is genuinely
  // reachable in every case below rather than being short-circuited.
  window.history.replaceState({}, "", FEATURE_PATH);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// No-replay policy — onboarding mutations
// ---------------------------------------------------------------------------

describe("retryOn401: false", () => {
  it("returns the 401 after exactly one request, with no refresh and no redirect", async () => {
    const original = unauthorized("start");
    const { calls } = createFetch(() => original);

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, {
      retryOn401: false,
    });

    expect(calls).toHaveLength(1);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(response).toBe(original);
    expect(window.location.pathname).toBe(FEATURE_PATH);
  });

  it("passes a successful response through untouched", async () => {
    const ok = new Response(JSON.stringify({ id: "p-1" }), { status: 200 });
    const { calls } = createFetch(() => ok);

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, {
      retryOn401: false,
    });

    expect(calls).toHaveLength(1);
    expect(response).toBe(ok);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("never lets the policy reach the request", async () => {
    const { calls } = createFetch(() => unauthorized("policy"));
    const policy: AuthRetryPolicy = {
      retryOn401: false,
      expectedPrincipalId: PRINCIPAL,
    };

    await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, policy);

    const sent = calls[0];
    expect(Object.keys(sent.init ?? {}).sort()).toEqual(["headers", "method"]);
    const headers = new Headers(sent.init?.headers);
    expect(headers.get("retryOn401")).toBeNull();
    expect(headers.get("expectedPrincipalId")).toBeNull();
    expect(JSON.stringify(sent.init)).not.toContain(PRINCIPAL);
    expect(JSON.stringify(sent.init)).not.toContain("retryOn401");
  });
});

// ---------------------------------------------------------------------------
// Default callers — preservation, not endorsement
// ---------------------------------------------------------------------------
//
// Every case here asserts today's behaviour for callers that pass no policy.
// They exist to detect a regression introduced by the new argument, not to
// endorse the default itself; the default mutation replay in particular is
// recorded as-is and remains a separate, unresolved concern.

describe("default callers keep their existing behaviour", () => {
  it("passes a non-401 response through without refreshing", async () => {
    const ok = new Response("{}", { status: 200 });
    const { calls } = createFetch(() => ok);

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(1);
    expect(response).toBe(ok);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("refreshes once and retries with the new credentials", async () => {
    const original = unauthorized("default-read");
    const retried = new Response("{}", { status: 200 });
    const { calls } = createFetch((call) => (call === 1 ? original : retried));
    mockGetSession.mockResolvedValue({ accessToken: "new-token" });

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(2);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(headerOf(calls[1], "Authorization")).toBe("Bearer new-token");
    expect(headerOf(calls[1], "oauth2")).toBe("new-token");
    expect(response).toBe(retried);
  });

  it("logs out when the refresh yields no token", async () => {
    const original = unauthorized("no-token");
    const { calls } = createFetch(() => original);
    mockGetSession.mockResolvedValue(null);

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(1);
    expectForcedLogout(response, original);
  });

  it("logs out when the refresh itself failed", async () => {
    const original = unauthorized("refresh-error");
    const { calls } = createFetch(() => original);
    mockGetSession.mockResolvedValue({
      accessToken: "new-token",
      error: "RefreshAccessTokenError",
    });

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(1);
    expectForcedLogout(response, original);
  });

  it("logs out when the refreshed token is unchanged", async () => {
    const original = unauthorized("same-token");
    const { calls } = createFetch(() => original);
    mockGetSession.mockResolvedValue({ accessToken: "old-token" });

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(1);
    expectForcedLogout(response, original);
  });

  it("logs out when the retry is refused as well", async () => {
    const original = unauthorized("first");
    const second = unauthorized("second");
    const { calls } = createFetch((call) => (call === 1 ? original : second));
    mockGetSession.mockResolvedValue({ accessToken: "new-token" });

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(2);
    expectForcedLogout(response, original);
    expect(response).not.toBe(second);
  });

  it("treats a throwing refresh as a failed one", async () => {
    const original = unauthorized("throwing-refresh");
    const { calls } = createFetch(() => original);
    mockGetSession.mockRejectedValue(new Error("network down"));

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT);

    expect(calls).toHaveLength(1);
    expectForcedLogout(response, original);
  });

  it("still replays a POST on 401 — recorded as the existing default", async () => {
    const original = unauthorized("default-post");
    const accepted = new Response('{"id":"p-9"}', { status: 200 });
    const { calls } = createFetch((call) => (call === 1 ? original : accepted));
    mockGetSession.mockResolvedValue({ accessToken: "new-token" });

    const response = await fetchWithAuth(
      URL_UNDER_TEST,
      { ...BEARER_INIT, method: "POST", body: '{"name":"x"}' },
      undefined,
    );

    // Two actual POSTs. This is exactly why the onboarding start binding opts
    // out; changing the default for every existing caller is not in scope and
    // would need a backend repeat-safety guarantee first.
    expect(calls).toHaveLength(2);
    expect(calls[1].init?.method).toBe("POST");
    expect(response).toBe(accepted);
  });

  it("does not pre-check an aborted signal for callers without a policy", async () => {
    const controller = new AbortController();
    controller.abort();
    const ok = new Response("{}", { status: 200 });
    const { calls } = createFetch(() => ok);

    const response = await fetchWithAuth(URL_UNDER_TEST, {
      ...BEARER_INIT,
      signal: controller.signal,
    });

    // The guard is opt-in: an existing caller's timing is unchanged, and the
    // real `fetch` is still the one that rejects an aborted request.
    expect(calls).toHaveLength(1);
    expect(response).toBe(ok);
  });
});

// ---------------------------------------------------------------------------
// Principal-verified retry — onboarding reads
// ---------------------------------------------------------------------------

describe("expectedPrincipalId", () => {
  it("refreshes and retries once for the same verified principal", async () => {
    const original = unauthorized("same-principal");
    const retried = new Response("{}", { status: 200 });
    const { calls } = createFetch((call) => (call === 1 ? original : retried));
    mockGetSession.mockResolvedValue({
      accessToken: "new-token",
      user: { id: PRINCIPAL },
    });

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, {
      retryOn401: true,
      expectedPrincipalId: PRINCIPAL,
    });

    expect(calls).toHaveLength(2);
    expect(headerOf(calls[1], "Authorization")).toBe("Bearer new-token");
    expect(headerOf(calls[1], "oauth2")).toBe("new-token");
    expect(calls[1].input).toBe(URL_UNDER_TEST);
    expect(response).toBe(retried);
  });

  it.each([
    ["a different principal", { id: OTHER_PRINCIPAL }],
    ["no principal", undefined],
    ["a blank principal", { id: "   " }],
    ["a non-string principal", { id: 42 }],
  ])(
    "returns the original 401 for %s, without retrying or logging out",
    async (_label, user) => {
      const original = unauthorized("cross-principal");
      const { calls } = createFetch(() => original);
      mockGetSession.mockResolvedValue({
        accessToken: "new-token",
        ...(user === undefined ? {} : { user }),
      });

      const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, {
        retryOn401: true,
        expectedPrincipalId: PRINCIPAL,
      });

      // One request, and the caller — not this helper — decides what a 401 for
      // an unverifiable principal means. Nobody is signed out.
      expect(calls).toHaveLength(1);
      expect(response).toBe(original);
      expect(window.location.pathname).toBe(FEATURE_PATH);
    },
  );

  it("returns the original 401 when the refresh produced no session at all", async () => {
    const original = unauthorized("no-session");
    const { calls } = createFetch(() => original);
    mockGetSession.mockResolvedValue(null);

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, {
      retryOn401: true,
      expectedPrincipalId: PRINCIPAL,
    });

    // The principal gate is checked before the token gate on this path, so a
    // failed refresh does not force a logout out of a scoped background read.
    expect(calls).toHaveLength(1);
    expect(response).toBe(original);
  });

  it("logs out only after a verified same-principal retry is refused again", async () => {
    const original = unauthorized("verified-first");
    const second = unauthorized("verified-second");
    const { calls } = createFetch((call) => (call === 1 ? original : second));
    mockGetSession.mockResolvedValue({
      accessToken: "new-token",
      user: { id: PRINCIPAL },
    });

    const response = await fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, {
      retryOn401: true,
      expectedPrincipalId: PRINCIPAL,
    });

    expect(calls).toHaveLength(2);
    expectForcedLogout(response, original);
  });
});

// ---------------------------------------------------------------------------
// Cancellation — opted-in only
// ---------------------------------------------------------------------------

describe("cancellation", () => {
  it("issues no request at all when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { calls } = createFetch(() => new Response("{}", { status: 200 }));

    await expect(
      fetchWithAuth(
        URL_UNDER_TEST,
        { ...BEARER_INIT, signal: controller.signal },
        { retryOn401: false },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(calls).toHaveLength(0);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("stops after a refresh that was cancelled, without retrying or redirecting", async () => {
    const controller = new AbortController();
    const original = unauthorized("aborted-refresh");
    const { calls } = createFetch(() => original);

    let releaseSession: (value: unknown) => void = () => {};
    mockGetSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSession = resolve;
        }),
    );

    const pending = fetchWithAuth(
      URL_UNDER_TEST,
      { ...BEARER_INIT, signal: controller.signal },
      { retryOn401: true, expectedPrincipalId: PRINCIPAL },
    );

    await flush();
    expect(calls).toHaveLength(1);
    expect(mockGetSession).toHaveBeenCalledTimes(1);

    // The view moved on while the refresh was in flight.
    controller.abort();
    releaseSession({ accessToken: "new-token", user: { id: PRINCIPAL } });

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });

    // No second request, and no navigation away from wherever the user now is.
    expect(calls).toHaveLength(1);
    expect(window.location.pathname).toBe(FEATURE_PATH);
  });
});

// ---------------------------------------------------------------------------
// Cancellation after the retry was dispatched
// ---------------------------------------------------------------------------
//
// A later await boundary than the block above, and a different guarantee. Once
// the retry has been sent it cannot be unsent, so these cases deliberately
// expect **two** requests. What must not happen is any further effect from an
// operation the caller has already abandoned: no logout navigation, and no
// late response handed back.
//
// **How that is proved.** `forceLogoutResponse()` is the only navigating path
// and it *resolves* with a synthetic 401. So an opted-in call that **rejects**
// with `AbortError` cannot have entered it — rejection and the synthetic
// response are mutually exclusive outcomes of the same return statement.

/** First request 401s; the retry is held open until the test releases it. */
const createRetryHarness = () => {
  const original = unauthorized("first-refusal");
  let releaseRetry: (response: Response) => void = () => {};
  let markDispatched: () => void = () => {};
  const dispatched = new Promise<void>((resolve) => {
    markDispatched = resolve;
  });

  const { calls } = createFetch((call) => {
    if (call === 1) return original;
    const held = new Promise<Response>((resolve) => {
      releaseRetry = resolve;
    });
    markDispatched();
    return held;
  });

  mockGetSession.mockResolvedValue({
    accessToken: "new-token",
    user: { id: PRINCIPAL },
  });

  return {
    calls,
    original,
    dispatched,
    release: (response: Response) => releaseRetry(response),
  };
};

const SCOPED_POLICY: AuthRetryPolicy = {
  retryOn401: true,
  expectedPrincipalId: PRINCIPAL,
};

describe("cancellation after the retry was dispatched", () => {
  it("rejects instead of logging out when cancelled while the retry is in flight", async () => {
    const controller = new AbortController();
    const harness = createRetryHarness();

    const pending = fetchWithAuth(
      URL_UNDER_TEST,
      { ...BEARER_INIT, signal: controller.signal },
      SCOPED_POLICY,
    );

    await harness.dispatched;
    expect(harness.calls).toHaveLength(2);

    // The route or account changed while the retried read was outstanding.
    controller.abort();
    harness.release(unauthorized("late-refusal"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });

    // The retry had already left; it is not undone, and nothing is claimed
    // about it. The tab simply stays where the user now is.
    expect(harness.calls).toHaveLength(2);
    expect(window.location.pathname).toBe(FEATURE_PATH);
  });

  it("rejects instead of logging out when cancelled between settlement and the continuation", async () => {
    const controller = new AbortController();
    const harness = createRetryHarness();

    const pending = fetchWithAuth(
      URL_UNDER_TEST,
      { ...BEARER_INIT, signal: controller.signal },
      SCOPED_POLICY,
    );

    await harness.dispatched;

    // The response promise settles first; the abort lands before the awaiting
    // continuation is scheduled to run. This is the second of the two timings
    // the review identified, and it reaches the same guard.
    harness.release(unauthorized("settled-refusal"));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });

    expect(harness.calls).toHaveLength(2);
    expect(window.location.pathname).toBe(FEATURE_PATH);
  });

  it("does not hand back a late successful response either", async () => {
    const controller = new AbortController();
    const harness = createRetryHarness();
    const late = new Response('{"id":"p-1"}', { status: 200 });

    const pending = fetchWithAuth(
      URL_UNDER_TEST,
      { ...BEARER_INIT, signal: controller.signal },
      SCOPED_POLICY,
    );

    await harness.dispatched;
    controller.abort();
    harness.release(late);

    // The guard precedes the plain return as well as the logout branch: a
    // caller that has moved on gets a cancellation, not stale data.
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(harness.calls).toHaveLength(2);
  });

  it("still logs out on a second 401 when nothing was cancelled", async () => {
    const harness = createRetryHarness();

    const pending = fetchWithAuth(URL_UNDER_TEST, BEARER_INIT, SCOPED_POLICY);

    await harness.dispatched;
    harness.release(unauthorized("second-refusal"));

    // The guard must not fire when there is no signal at all: ordinary
    // same-principal behaviour is unchanged.
    expectForcedLogout(await pending, harness.original);
    expect(harness.calls).toHaveLength(2);
  });

  it("leaves a default caller's late cancellation exactly as it was", async () => {
    const controller = new AbortController();
    const harness = createRetryHarness();

    const pending = fetchWithAuth(URL_UNDER_TEST, {
      ...BEARER_INIT,
      signal: controller.signal,
    });

    await harness.dispatched;
    controller.abort();
    harness.release(unauthorized("default-late-refusal"));

    // No policy, so no guard: this caller still resolves with the forced
    // logout response, as it did before the correction. Only opted-in callers
    // changed.
    expectForcedLogout(await pending, harness.original);
    expect(harness.calls).toHaveLength(2);
  });
});
