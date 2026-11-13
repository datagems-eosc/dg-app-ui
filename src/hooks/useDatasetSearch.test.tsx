import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DatasetSearchScope, useDatasetSearch } from "./useDatasetSearch";

const api = {
  hasToken: true,
  queryDatasets: vi.fn(),
  queryUserCollections: vi.fn(),
  searchCrossDataset: vi.fn(),
};

// useApi returns a new object on every render, as the real hook does.
vi.mock("@/hooks/useApi", () => ({ useApi: () => ({ ...api }) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const ALL: DatasetSearchScope = { kind: "all" };

const catalogueCalls = () => api.queryDatasets.mock.calls.map(([p]) => p);
const lastCatalogue = () => catalogueCalls().at(-1);

const renderSearch = (scope: DatasetSearchScope | null = ALL) =>
  renderHook(({ scope }) => useDatasetSearch({ scope }), {
    initialProps: { scope },
  });

describe("useDatasetSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.hasToken = true;
    api.queryDatasets.mockResolvedValue({ items: [], count: 0 });
    api.searchCrossDataset.mockResolvedValue({ result: [] });
  });

  describe("name search", () => {
    it("sends the typed text unescaped", async () => {
      // The dataset `like` on dev does not honour backslash escapes: an
      // escaped "test_Best" finds nothing (known bug).
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

      act(() => result.current.onSearchTermSubmit("air_quality"));

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
      expect(lastCatalogue().like).toBe("%air_quality%");
    });

    it("sends ordinary text as before", async () => {
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

      act(() => result.current.onSearchTermSubmit("wiki"));

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
      expect(lastCatalogue().like).toBe("%wiki%");
    });
  });

  describe("Smart search in a collection", () => {
    it("asks discovery for the collection only", async () => {
      api.searchCrossDataset.mockResolvedValue({
        result: [
          {
            dataset: {
              id: "s1",
              name: "Rain",
              collections: [{ id: "col-1", name: "Weather" }],
            },
          },
        ],
      });
      const { result } = renderSearch({ kind: "collection", id: "col-1" });
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      expect(lastCatalogue().collectionIds).toEqual(["col-1"]);

      act(() => result.current.onSearchTermChange("rain in Crete"));
      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
      const [payload] = api.searchCrossDataset.mock.calls[0];
      expect(payload.collectionIds).toEqual(["col-1"]);
      expect(payload.query).toBe("rain in Crete");
      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["s1"]),
      );
    });

    it("drops Smart results from outside the collection", async () => {
      // Dev discovery does not always honour collectionIds.
      api.searchCrossDataset.mockResolvedValue({
        result: [
          {
            dataset: {
              id: "in",
              name: "Wiki",
              collections: [{ id: "col-1", name: "Language" }],
            },
          },
          { dataset: { id: "none", name: "Books", collections: [] } },
          {
            dataset: {
              id: "other",
              name: "Rain",
              collections: [{ id: "col-2", name: "Weather" }],
            },
          },
        ],
      });
      const { result } = renderSearch({ kind: "collection", id: "col-1" });
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

      act(() => result.current.onSearchTermChange("wikipedia text"));
      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["in"]),
      );
    });

    it("keeps every Smart result for the whole catalogue", async () => {
      api.searchCrossDataset.mockResolvedValue({
        result: [
          { dataset: { id: "a", name: "A", collections: [] } },
          {
            dataset: {
              id: "b",
              name: "B",
              collections: [{ id: "col-2", name: "Weather" }],
            },
          },
        ],
      });
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

      act(() => result.current.onSearchTermChange("rain in Crete"));
      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["a", "b"]),
      );
    });

    it("sends no collection filter for the whole catalogue", async () => {
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

      act(() => result.current.onSearchTermChange("rain in Crete"));
      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
      expect(api.searchCrossDataset.mock.calls[0][0].collectionIds).toBe(
        undefined,
      );
    });

    it("keeps keyword search for a custom collection", async () => {
      api.queryUserCollections.mockResolvedValue({
        items: [{ id: "mine", datasets: [{ id: "a" }] }],
      });
      api.queryDatasets.mockResolvedValue({ items: [{ id: "a", name: "A" }] });
      const { result } = renderSearch({ kind: "custom", id: "mine" });
      await waitFor(() => expect(result.current.datasets).toHaveLength(1));

      act(() => result.current.onSearchTermChange("rain in Crete"));
      act(() => result.current.onSmartSearchToggle(true));
      await waitFor(() =>
        expect(api.queryUserCollections).toHaveBeenCalledTimes(2),
      );

      expect(api.searchCrossDataset).not.toHaveBeenCalled();
    });
  });

  describe("switching collections", () => {
    it("clears the search and lists the new collection once", async () => {
      const { result, rerender } = renderSearch({
        kind: "collection",
        id: "col-1",
      });
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      act(() => result.current.onSearchTermSubmit("rain"));
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));

      rerender({ scope: { kind: "collection", id: "col-2" } });

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(3));
      await act(async () => {});
      expect(api.queryDatasets).toHaveBeenCalledTimes(3);
      expect(result.current.pendingSearchTerm).toBe("");
      expect(result.current.appliedSearchTerm).toBe("");
      expect(lastCatalogue().like).toBe(undefined);
      expect(lastCatalogue().collectionIds).toEqual(["col-2"]);
    });

    it("asks for nothing while the scope is unknown", async () => {
      const { rerender } = renderSearch(null);
      await act(async () => {});
      expect(api.queryDatasets).not.toHaveBeenCalled();

      rerender({ scope: { kind: "collection", id: "col-1" } });

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    });
  });

  describe("switching Smart search", () => {
    it("sends nothing when the box is empty and sort and filters are default", async () => {
      const { result } = renderSearch();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onSmartSearchToggle(true));
      act(() => result.current.onSmartSearchToggle(false));
      await act(async () => {});

      expect(api.queryDatasets).toHaveBeenCalledTimes(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSmartSearchEnabled).toBe(false);
    });

    it("keeps the loaded list when nothing is sent", async () => {
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ id: "a", name: "A" }],
        count: 30,
      });
      const { result } = renderSearch();
      await waitFor(() => expect(result.current.datasets).toHaveLength(1));

      act(() => result.current.onSmartSearchToggle(true));
      await act(async () => {});

      expect(result.current.datasets.map((d) => d.id)).toEqual(["a"]);
      expect(result.current.hasMore).toBe(true);
    });

    it("lists again when Smart search drops a non-default sort", async () => {
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      act(() => result.current.onSortByChange("datePublished-desc"));
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));

      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(3));
      expect(lastCatalogue().Order).toEqual({ Items: ["+name"] });
    });

    it("lists the catalogue again after Smart results, even for the same request", async () => {
      api.searchCrossDataset.mockResolvedValue({
        result: [{ dataset: { id: "s1", name: "Smart" } }],
      });
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      act(() => result.current.onSearchTermChange("rain"));
      act(() => result.current.onSmartSearchToggle(true));
      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["s1"]),
      );

      // The box is emptied, then Smart is switched off: the request matches
      // the first one, but the list on screen is Smart results.
      act(() => result.current.onSearchTermChange(""));
      act(() => result.current.onSmartSearchToggle(false));

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    });

    it("still searches when the same text is submitted again", async () => {
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

      act(() => result.current.onSearchTermSubmit("rain"));
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
      act(() => result.current.onSearchTermSubmit("rain"));

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(3));
    });
  });
});
