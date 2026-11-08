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
    expect(logWarn).toHaveBeenCalledWith(
      "Query recommendations unavailable",
      expect.objectContaining({ status: 500, error: "System error" }),
    );
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
