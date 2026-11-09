import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: vi.fn(),
}));

import { useApi } from "./useApi";

const COLLECTION_ID = "12c6ef31-23da-48d7-83b5-ec09b170ca28";
const OTHER_COLLECTION_ID = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const API_BASE = "https://gateway.test";

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "test-token", user: { id: "test-user" } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collection context grants", () => {
  it("returns the roles under the requested collection ID", async () => {
    const roles = [
      "dg_col-manage",
      "dg_col-edit",
      "dg_col-delete",
      "dg_col-browse",
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ [COLLECTION_ID]: roles })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual(roles);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/gw/api/principal/me/context-grants/collection?id=${COLLECTION_ID}`,
    );
  });
  it("returns no roles for an empty map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}))),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual([]);
  });
  it("returns no roles when only another collection has roles", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ [OTHER_COLLECTION_ID]: ["dg_col-delete"] }),
          ),
        ),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual([]);
  });
  it("returns no roles for an explicitly empty list", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ [COLLECTION_ID]: [] })),
        ),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual([]);
  });
  it("does not combine roles from multiple collections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            [COLLECTION_ID]: ["dg_col-browse"],
            [OTHER_COLLECTION_ID]: ["dg_col-delete"],
          }),
        ),
      ),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual(["dg_col-browse"]);
  });
  it("does not read a legacy grants property", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ grants: ["dg_col-delete"] })),
        ),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual([]);
  });
  it("returns no roles on HTTP 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 403 })),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual([]);
  });
  it("returns no roles on HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 500 })),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).resolves.toEqual([]);
  });
  it("does not grant roles after a transport failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Network unavailable")),
    );
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).rejects.toThrow("Network unavailable");
  });
  it("sends no request without an authenticated token", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useApi());
    await expect(
      result.current.getCollectionGrants(COLLECTION_ID),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
