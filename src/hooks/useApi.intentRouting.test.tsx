import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: vi.fn(),
}));

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

describe("useApi().classifyIntent", () => {
  it("sends one authenticated classifier request through the Gateway prefix", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            result: { intent: 0, degraded: false, searchQuery: "education" },
            conversationId: null,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useApi());

    const outcome = await result.current.classifyIntent(
      "datasets about education",
    );

    expect(outcome).toEqual({
      ok: true,
      classification: expect.objectContaining({
        intent: "dataset_search",
        retrievalQuery: "education",
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(
      url.startsWith(`${API_BASE}/gw/api/search/disambiguate-intent?f=intent`),
    ).toBe(true);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1",
    );
  });

  it("reports auth without a request when there is no token", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useApi());

    await expect(result.current.classifyIntent("q")).resolves.toEqual({
      ok: false,
      kind: "auth",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
