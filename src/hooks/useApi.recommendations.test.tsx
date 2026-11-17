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

  it("returns the datasets when the recommender answers with some", async () => {
    respond(200, [{ id: "r1", name: "Alpha" }]);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({
      status: "datasets",
      datasets: [{ id: "r1", name: "Alpha" }],
    });
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

  it("returns none when the recommender answers with an empty list", async () => {
    respond(200, []);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "none" });
  });

  it("returns none when a successful answer is not a list", async () => {
    respond(200, { items: [] });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "none" });
  });

  it("returns no access on 401 and does not sign the user out", async () => {
    respond(401, { code: 101, error: "insufficient rights" });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getDatasetRecommendations("d1"),
    ).resolves.toEqual({ status: "noAccess" });
    // Only the recommend call: no session refresh, no sign-out round trip.
    expect(fetch).toHaveBeenCalledTimes(1);
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
