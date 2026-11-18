import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/logger")>();
  return { ...actual, logApiError: vi.fn(), logWarn: vi.fn() };
});

import { getSession } from "next-auth/react";
import { logApiError, logWarn } from "@/lib/logger";
import { useApi } from "./useApi";

const API_BASE = "https://gateway.test/dg";

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "token-1", user: { id: "u-1" } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useApi().getRecommendNextQueries", () => {
  it("rejects with a warning, not an error log, when the Gateway fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "System error" }), {
            status: 500,
          }),
      ),
    );
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getRecommendNextQueries("rainfall in Athens", "c-1"),
    ).rejects.toThrow("System error");

    expect(logApiError).not.toHaveBeenCalled();
    // Status only: a Gateway message can echo the user's query.
    expect(logWarn).toHaveBeenCalledWith("Query recommendations unavailable", {
      status: 500,
    });
  });

  it("warns without a Gateway message when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad gateway", { status: 502 })),
    );
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getRecommendNextQueries("rainfall in Athens"),
    ).rejects.toThrow();

    expect(logApiError).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(
      "Query recommendations unavailable",
      expect.objectContaining({ status: 502 }),
    );
  });
});

describe("useApi().getDatasetRecommendations", () => {
  const respond = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    );

  it("returns the datasets, mapped for display, when the recommender answers with some", async () => {
    respond(200, [{ id: "r1", name: "Alpha", license: "MIT" }]);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toMatchObject({
      status: "datasets",
      datasets: [{ id: "r1", title: "Alpha", license: "MIT" }],
    });
  });

  it("keeps at most six datasets when the answer holds more", async () => {
    respond(
      200,
      Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, name: `D${i}` })),
    );
    const { result } = renderHook(() => useApi());

    const answer = await result.current.getDatasetRecommendations("d1");

    expect(answer.status === "datasets" && answer.datasets).toHaveLength(6);
  });

  it("asks for six recommendations of the given dataset with the bearer token", async () => {
    respond(200, []);
    const { result } = renderHook(() => useApi());

    await result.current.getDatasetRecommendations("d 1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(
      `${API_BASE}/gw/api/search/dataset/d%201/recommend?`,
    );
    expect(String(url)).toContain("n=6");
    expect(String(url)).toContain("f=license");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1",
    );
  });

  // Only what the card shows (and the id it opens); new fields are a choice.
  it("asks only for the fields the card shows", async () => {
    respond(200, []);
    const { result } = renderHook(() => useApi());

    await result.current.getDatasetRecommendations("d1");

    const query = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
      .searchParams;
    expect(query.getAll("f")).toEqual([
      "id",
      "name",
      "description",
      "license",
      "collections.id",
      "collections.name",
    ]);
    expect(query.get("n")).toBe("6");
  });

  it("returns none when the recommender answers with an empty list", async () => {
    respond(200, []);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "none" });
  });

  // An answer outside the contract is unknown, not "none": fail closed.
  it("returns failed when a successful answer is not a list", async () => {
    respond(200, { items: [] });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "failed" });
  });

  it("returns no access on 401 and does not sign the user out", async () => {
    respond(401, { code: 101, error: "insufficient rights" });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "noAccess" });
    // Only the recommend call: no session refresh, no sign-out round trip.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each([424, 403, 404, 500, 502])(
    "returns failed on HTTP %i",
    async (status) => {
      respond(status, { code: 104, error: "System error" });
      const { result } = renderHook(() => useApi());

      await expect(
        result.current.getDatasetRecommendations("d1"),
      ).resolves.toEqual({ status: "failed" });
    },
  );

  it("returns failed when the request cannot be sent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "failed" });
  });

  it("returns failed when a successful answer is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 200 })),
    );
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "failed" });
  });

  it("returns failed without calling the Gateway when the id cannot go in a URL", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useApi());

    // A lone surrogate makes encodeURIComponent throw a URIError.
    await expect(
      result.current.getDatasetRecommendations("\uD800"),
    ).resolves.toEqual({ status: "failed" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns failed without calling the Gateway when there is no session token", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "failed" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("useApi().getDatasetFeatures", () => {
  const respond = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    );

  it("asks for the dataset's features with the bearer token and returns the flags", async () => {
    respond(200, {
      id: "d 1",
      features: { profiled: true, packaged: false, recommendation: false },
    });
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d 1")).resolves.toEqual({
      profiled: true,
      packaged: false,
      recommendation: false,
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      `${API_BASE}/gw/api/dataset/d%201?f=id&f=features`,
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1",
    );
  });

  it("returns null on 401 and does not sign the user out", async () => {
    respond(401, { code: 101, error: "insufficient rights" });
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d1")).resolves.toBeNull();
    // Only the features call: no session refresh, no sign-out round trip.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each([403, 404, 424, 500])("returns null on HTTP %i", async (status) => {
    respond(status, { code: 104, error: "System error" });
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d1")).resolves.toBeNull();
  });

  it("returns null when the answer has no features", async () => {
    respond(200, { id: "d1" });
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d1")).resolves.toBeNull();
  });

  it("returns null when a successful answer is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 200 })),
    );
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d1")).resolves.toBeNull();
  });

  it("returns null when the request cannot be sent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d1")).resolves.toBeNull();
  });

  it("returns null without calling the Gateway when the id cannot go in a URL", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetFeatures("\uD800"),
    ).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns null without calling the Gateway when there is no session token", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useApi());

    await expect(result.current.getDatasetFeatures("d1")).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
