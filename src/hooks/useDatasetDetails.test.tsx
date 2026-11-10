import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logWarn } from "@/lib/logger";
import { useDatasetDetails } from "./useDatasetDetails";

const api = {
  hasToken: true,
  queryDatasets: vi.fn(),
};

// useApi returns a new object on every render, as the real hook does.
vi.mock("@/hooks/useApi", () => ({ useApi: () => ({ ...api }) }));
vi.mock("@/lib/logger", () => ({ logWarn: vi.fn() }));

const item = (id: string) => ({ id, name: `Dataset ${id}` });
const requestedIds = (call: number) =>
  api.queryDatasets.mock.calls[call][0].ids as string[];
const ids = (list: { id: string }[]) => list.map((d) => d.id);

describe("useDatasetDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.hasToken = true;
    api.queryDatasets.mockImplementation(async (payload) => ({
      items: (payload.ids as string[]).map(item),
    }));
  });

  it("loads details for the given ids in one request by id", async () => {
    const { result } = renderHook(() => useDatasetDetails(["a", "b"]));

    await waitFor(() => expect(ids(result.current)).toEqual(["a", "b"]));
    expect(api.queryDatasets).toHaveBeenCalledTimes(1);
    expect(requestedIds(0)).toEqual(["a", "b"]);
    // The Gateway rejects a dataset query without an order (400).
    expect(api.queryDatasets.mock.calls[0][0].Order).toEqual({
      Items: ["+code"],
    });
  });

  it("keeps every loaded dataset when an earlier response arrives last", async () => {
    let releaseFirst: (value: unknown) => void = () => {};
    api.queryDatasets
      .mockImplementationOnce(
        (payload) =>
          new Promise((resolve) => {
            releaseFirst = () =>
              resolve({ items: (payload.ids as string[]).map(item) });
          }),
      )
      .mockImplementationOnce(async (payload) => ({
        items: (payload.ids as string[]).map(item),
      }));

    const { result, rerender } = renderHook(
      ({ list }) => useDatasetDetails(list),
      { initialProps: { list: ["a"] } },
    );
    rerender({ list: ["a", "b"] });
    await waitFor(() => expect(ids(result.current)).toContain("b"));

    await act(async () => releaseFirst(undefined));

    expect(ids(result.current).sort()).toEqual(["a", "b"]);
  });

  it("waits for a session before requesting", async () => {
    api.hasToken = false;
    const { result, rerender } = renderHook(() => useDatasetDetails(["a"]));
    expect(api.queryDatasets).not.toHaveBeenCalled();

    api.hasToken = true;
    rerender();

    await waitFor(() => expect(ids(result.current)).toEqual(["a"]));
  });

  it("logs a failed request and asks for those ids again on the next change", async () => {
    api.queryDatasets.mockRejectedValueOnce(new Error("Gateway down"));
    const { result, rerender } = renderHook(
      ({ list }) => useDatasetDetails(list),
      { initialProps: { list: ["a"] } },
    );
    await waitFor(() => expect(logWarn).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([]);

    rerender({ list: ["a", "b"] });

    await waitFor(() => expect(ids(result.current)).toEqual(["a", "b"]));
    expect(requestedIds(1)).toEqual(["a", "b"]);
  });

  it("requests only ids it has not asked for, and not again for ids the Gateway did not return", async () => {
    api.queryDatasets.mockImplementation(async (payload) => ({
      items: (payload.ids as string[]).filter((id) => id !== "gone").map(item),
    }));
    const { result, rerender } = renderHook(
      ({ list }) => useDatasetDetails(list),
      { initialProps: { list: ["a", "gone"] } },
    );
    await waitFor(() => expect(ids(result.current)).toEqual(["a"]));

    rerender({ list: ["a", "gone", "c"] });

    await waitFor(() => expect(ids(result.current)).toEqual(["a", "c"]));
    expect(api.queryDatasets).toHaveBeenCalledTimes(2);
    expect(requestedIds(1)).toEqual(["c"]);
  });

  it("requests nothing for an empty list", () => {
    const { result } = renderHook(() => useDatasetDetails([]));

    expect(result.current).toEqual([]);
    expect(api.queryDatasets).not.toHaveBeenCalled();
  });

  it("does not retry a failed request on every render", async () => {
    api.queryDatasets.mockRejectedValue(new Error("Bad request"));
    const { rerender } = renderHook(() => useDatasetDetails(["a"]));
    await waitFor(() => expect(logWarn).toHaveBeenCalledTimes(1));

    rerender();
    rerender();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.queryDatasets).toHaveBeenCalledTimes(1);
  });
});
