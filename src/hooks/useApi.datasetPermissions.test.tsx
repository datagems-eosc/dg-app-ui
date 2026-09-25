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
  RESEARCH_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import { useApi } from "./useApi";

/**
 * The transport seam for dataset group access.
 *
 * The mocked boundaries are the *session* and `fetch`; everything between them
 * is real — `useApi`'s private `makeRequest`, `fetchWithAuth` and the accepted
 * `createDatasetPermissionsGateway` all run as they do in the application. So
 * the request counts, URLs and headers asserted here are the ones a browser
 * would actually produce, not a re-statement of the adapter's intentions.
 *
 * The question this file exists to answer is narrow and safety-shaped: can a
 * refreshed token cause a **second grant or revoke to be sent**? Everything
 * else below is context for that one.
 */

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";
const ROLE = "dg_ds-browse";

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

const unauthorized = () => new Response(null, { status: 401 });

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

const renderApi = () => renderHook(() => useApi());

const operation = {
  operationId: "op-1",
  datasetId: DATASET_ID,
  groupId: RESEARCH_GROUP_ID,
  role: ROLE,
  action: "assign" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue(session());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the dataset-permissions binding", () => {
  it.each([
    ["loading", { status: "loading" as const }, "loading"],
    ["signed out", { status: "unauthenticated" as const }, "unauthenticated"],
    ["a session error", { error: "RefreshAccessTokenError" }, "session-error"],
    ["no access token", { accessToken: undefined }, "credentials-unavailable"],
    ["no user id", { userId: undefined }, "identity-unavailable"],
    ["a blank user id", { userId: "   " }, "identity-unavailable"],
  ])("resolves no scope for %s", (_label, options, expected) => {
    mockUseSession.mockReturnValue(session(options));
    const { result } = renderApi();

    expect(result.current.datasetPermissions.auth).toBe(expected);
    expect(result.current.datasetPermissions.scope).toBeNull();
  });

  it("captures the principal and the whole configured base as the environment", () => {
    const { result } = renderApi();
    expect(result.current.datasetPermissions.scope).toEqual({
      principalId: PRINCIPAL,
      gatewayOrigin: API_BASE,
    });
  });

  it("sends nothing at all when no identity is resolved", async () => {
    mockUseSession.mockReturnValue(session({ userId: undefined }));
    const { fetchMock } = createFetch(() => json({}));
    const { result } = renderApi();

    const outcome =
      await result.current.datasetPermissions.gateway.assignRole(operation);

    // Refused before a URL exists. Nothing reached the Gateway, so the outcome
    // is uncertain rather than a claim that the write did not happen.
    expect(outcome.kind).toBe("uncertain");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the member stable across renders so a consumer effect does not re-run", () => {
    const { result, rerender } = renderApi();
    const first = result.current.datasetPermissions;
    rerender();
    expect(result.current.datasetPermissions).toBe(first);
  });
});

describe("what travels with a request", () => {
  it("applies the bearer token and the /gw/api prefix, once", async () => {
    const { calls } = createFetch(() => json({ permissions: [] }));
    const { result } = renderApi();

    await result.current.datasetPermissions.gateway.readGlobalPermissions();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API_BASE}/gw/api/principal/me?f=permissions`);
    expect(new Headers(calls[0].init?.headers).get("Authorization")).toBe(
      "Bearer token-1",
    );
  });

  it("encodes every mutation path segment", async () => {
    const { calls } = createFetch(() => new Response(null, { status: 200 }));
    const { result } = renderApi();

    await result.current.datasetPermissions.gateway.assignRole({
      ...operation,
      groupId: "group/../other",
      role: "dg_ds-browse?x=1",
    });

    expect(calls[0].url).toBe(
      `${API_BASE}/gw/api/principal/context-grants/group/group%2F..%2Fother` +
        `/dataset/${DATASET_ID}/role/dg_ds-browse%3Fx%3D1`,
    );
  });

  it("carries an abort signal through to fetch", async () => {
    const controller = new AbortController();
    const { calls } = createFetch(() => json({ permissions: [] }));
    const { result } = renderApi();

    await result.current.datasetPermissions.gateway.readGlobalPermissions(
      controller.signal,
    );

    expect(calls[0].init?.signal).toBe(controller.signal);
  });

  it("reports an aborted read as cancelled rather than as a failure to decide", async () => {
    const controller = new AbortController();
    controller.abort();
    createFetch(() => json({ permissions: [] }));
    const { result } = renderApi();

    const read =
      await result.current.datasetPermissions.gateway.readGlobalPermissions(
        controller.signal,
      );

    expect(read.failure?.kind).toBe("cancelled");
    expect(read.evidence.kind).toBe("failed");
  });
});

/**
 * The rule the whole binding exists for.
 *
 * A 401 on a read may be an expired token, and refreshing one is ordinary. A
 * 401 on a *mutation* is different: the transport cannot tell whether the
 * first attempt reached the action body, so a silent second attempt could
 * duplicate a grant. The decision to resubmit has to stay with the caller,
 * which holds the outcome.
 */
describe("401 handling", () => {
  it("never replays a grant", async () => {
    const { fetchMock } = createFetch(() => unauthorized());
    const { result } = renderApi();

    const outcome =
      await result.current.datasetPermissions.gateway.assignRole(operation);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockGetSession).not.toHaveBeenCalled();
    // A refusal raised before the action body, per the accepted mapping.
    expect(outcome).toEqual({ kind: "refused", httpStatus: 401 });
  });

  it("never replays a revoke either", async () => {
    const { fetchMock } = createFetch(() => unauthorized());
    const { result } = renderApi();

    await result.current.datasetPermissions.gateway.removeRole({
      ...operation,
      action: "remove",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("retries a read once for the same principal, with the refreshed token", async () => {
    const { fetchMock, calls } = createFetch((call) =>
      call === 1 ? unauthorized() : json({ permissions: ["BrowseDataset"] }),
    );
    mockGetSession.mockResolvedValue({
      accessToken: "token-2",
      user: { id: PRINCIPAL },
    });
    const { result } = renderApi();

    const read =
      await result.current.datasetPermissions.gateway.readGlobalPermissions();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(calls[1].init?.headers).get("Authorization")).toBe(
      "Bearer token-2",
    );
    expect(read.evidence).toEqual({
      kind: "read",
      names: ["BrowseDataset"],
      coverage: { kind: "exhaustive" },
    });
  });

  it("does not retry a read with a refreshed session belonging to someone else", async () => {
    const { fetchMock } = createFetch(() => unauthorized());
    mockGetSession.mockResolvedValue({
      accessToken: "token-2",
      user: { id: OTHER_PRINCIPAL },
    });
    const { result } = renderApi();

    const read =
      await result.current.datasetPermissions.gateway.readGlobalPermissions();

    // A new token is not evidence that the same person is still signed in.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(read.failure).toEqual({ kind: "unauthorized", httpStatus: 401 });
  });

  it("treats the group query as the read it is, although it is a POST", async () => {
    const { fetchMock } = createFetch((call) =>
      call === 1 ? unauthorized() : json({ items: [] }),
    );
    mockGetSession.mockResolvedValue({
      accessToken: "token-2",
      user: { id: PRINCIPAL },
    });
    const { result } = renderApi();

    await result.current.datasetPermissions.gateway.queryGroups();

    // Classified by what the call *is*, not by its HTTP method: group
    // discovery changes nothing, so refreshing and asking again is safe.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("isolation from the existing helpers", () => {
  it("does not share a binding with dataset onboarding", () => {
    const { result } = renderApi();
    expect(result.current.datasetPermissions.gateway).not.toBe(
      result.current.datasetOnboarding.gateway,
    );
  });

  it("leaves the legacy group helpers in place and untouched", () => {
    const { result } = renderApi();
    for (const helper of [
      "queryUserGroups",
      "getGroupDatasetGrants",
      "assignGroupDatasetGrant",
      "unassignGroupDatasetGrant",
    ] as const) {
      expect(typeof result.current[helper]).toBe("function");
    }
  });
});
