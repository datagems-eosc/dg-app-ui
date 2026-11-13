import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionsProvider, useCollections } from "./CollectionsContext";

const api = {
  hasToken: true,
  queryCollections: vi.fn(),
  queryUserCollections: vi.fn(),
};

let pathname = "/browse";

// useApi returns a new object on every render, as the real hook does.
vi.mock("@/hooks/useApi", () => ({ useApi: () => ({ ...api }) }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/logger", () => ({
  default: { debug: vi.fn() },
  logApiError: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <CollectionsProvider>{children}</CollectionsProvider>
);

const renderCollections = () => renderHook(() => useCollections(), { wrapper });

const settled = (state: ReturnType<typeof useCollections>) =>
  !state.isLoadingApiCollections && !state.isLoadingExtraCollections;

describe("CollectionsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/browse";
    api.hasToken = true;
    api.queryCollections.mockResolvedValue({ items: [{ id: "lang" }] });
    api.queryUserCollections.mockResolvedValue({ items: [{ id: "mine" }] });
  });

  it("loads both collection lists once", async () => {
    const { result } = renderCollections();
    await waitFor(() => expect(settled(result.current)).toBe(true));

    expect(result.current.apiCollections).toEqual([{ id: "lang" }]);
    expect(result.current.extraCollections).toEqual([{ id: "mine" }]);
    expect(result.current.apiCollectionsFailed).toBe(false);
    expect(api.queryCollections).toHaveBeenCalledTimes(1);
    expect(api.queryUserCollections).toHaveBeenCalledTimes(1);
  });

  it("says which collection list failed to load", async () => {
    api.queryCollections.mockRejectedValueOnce(new Error("down"));

    const { result } = renderCollections();
    await waitFor(() => expect(settled(result.current)).toBe(true));

    expect(result.current.apiCollectionsFailed).toBe(true);
    expect(result.current.apiCollections).toEqual([]);
    expect(result.current.extraCollections).toEqual([{ id: "mine" }]);
  });

  it("asks again for the built-in list that failed when the page changes", async () => {
    api.queryCollections.mockRejectedValueOnce(new Error("down"));
    const { result, rerender } = renderCollections();
    await waitFor(() => expect(settled(result.current)).toBe(true));

    pathname = "/use-case/math/datasets";
    rerender();

    await waitFor(() =>
      expect(result.current.apiCollections).toEqual([{ id: "lang" }]),
    );
    expect(result.current.apiCollectionsFailed).toBe(false);
    expect(api.queryCollections).toHaveBeenCalledTimes(2);
    expect(api.queryUserCollections).toHaveBeenCalledTimes(1);
  });

  it("asks again for the user's list that failed when the page changes", async () => {
    api.queryUserCollections.mockRejectedValueOnce(new Error("down"));
    const { result, rerender } = renderCollections();
    await waitFor(() => expect(settled(result.current)).toBe(true));

    pathname = "/collections/favorites";
    rerender();

    await waitFor(() =>
      expect(result.current.extraCollections).toEqual([{ id: "mine" }]),
    );
    expect(api.queryUserCollections).toHaveBeenCalledTimes(2);
    expect(api.queryCollections).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing on a page change when both lists loaded", async () => {
    const { result, rerender } = renderCollections();
    await waitFor(() => expect(settled(result.current)).toBe(true));

    pathname = "/chat";
    rerender();
    await act(async () => {});

    expect(api.queryCollections).toHaveBeenCalledTimes(1);
    expect(api.queryUserCollections).toHaveBeenCalledTimes(1);
  });

  it("asks once per page change while the list keeps failing", async () => {
    api.queryCollections.mockRejectedValue(new Error("down"));
    const { result, rerender } = renderCollections();
    await waitFor(() => expect(settled(result.current)).toBe(true));

    pathname = "/chat";
    rerender();
    await waitFor(() => expect(api.queryCollections).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(settled(result.current)).toBe(true));
    await act(async () => {});

    expect(api.queryCollections).toHaveBeenCalledTimes(2);
    expect(result.current.apiCollectionsFailed).toBe(true);
  });
});
