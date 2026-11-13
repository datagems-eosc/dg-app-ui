import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorMessage } from "@/lib/apiErrors";
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

    it("lists a custom collection once whatever the search controls say", async () => {
      api.queryUserCollections.mockResolvedValue({
        items: [{ id: "mine", datasets: [{ id: "a" }] }],
      });
      api.queryDatasets.mockResolvedValue({ items: [{ id: "a", name: "A" }] });
      const { result } = renderSearch({ kind: "custom", id: "mine" });
      await waitFor(() => expect(result.current.datasets).toHaveLength(1));

      act(() => result.current.onSearchTermChange("rain in Crete"));
      act(() => result.current.onSmartSearchToggle(true));
      act(() => result.current.onSortByChange("name-desc"));
      await act(async () => {});

      expect(api.queryUserCollections).toHaveBeenCalledTimes(1);
      expect(api.searchCrossDataset).not.toHaveBeenCalled();
      expect(result.current.datasets).toHaveLength(1);
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
      expect(result.current.searchTerm).toBe("");
      expect(result.current.appliedSearchTerm).toBe("");
      expect(lastCatalogue().like).toBe(undefined);
      expect(lastCatalogue().collectionIds).toEqual(["col-2"]);
    });

    it("keeps a search submitted while the scope was still unknown", async () => {
      const { result, rerender } = renderSearch(null);
      act(() => result.current.onSearchTermChange("rain"));
      act(() => result.current.onSearchTermSubmit());

      rerender({ scope: { kind: "collection", id: "col-1" } });

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      expect(lastCatalogue().like).toBe("%rain%");
      expect(result.current.searchTerm).toBe("rain");
    });

    it("clears the search when a collection opens from all datasets", async () => {
      const { result, rerender } = renderSearch(ALL);
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      act(() => result.current.onSearchTermSubmit("rain"));
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));

      rerender({ scope: { kind: "collection", id: "col-1" } });

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(3));
      expect(lastCatalogue().like).toBe(undefined);
      expect(result.current.searchTerm).toBe("");
    });

    it("asks for nothing while the scope is unknown", async () => {
      const { rerender } = renderSearch(null);
      await act(async () => {});
      expect(api.queryDatasets).not.toHaveBeenCalled();

      rerender({ scope: { kind: "collection", id: "col-1" } });

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    });
  });

  describe("failures", () => {
    it("reports a failed list without the Gateway's own text", async () => {
      api.queryDatasets.mockRejectedValue(
        new Error("Server error (500): NullReferenceException at Lookup"),
      );
      const { result } = renderSearch({ kind: "collection", id: "col-1" });

      await waitFor(() =>
        expect(result.current.error).toBe("Failed to fetch datasets"),
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("clears the earlier list when a new search fails", async () => {
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ id: "old", name: "Old" }],
        count: 1,
      });
      const { result } = renderSearch();
      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["old"]),
      );
      api.queryDatasets.mockRejectedValueOnce(new Error("500"));

      act(() => result.current.onSearchTermSubmit("rain"));

      await waitFor(() =>
        expect(result.current.error).toBe("Failed to fetch datasets"),
      );
      expect(result.current.datasets).toEqual([]);
    });

    it("clears the earlier list when Smart search fails", async () => {
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ id: "old", name: "Old" }],
        count: 1,
      });
      api.searchCrossDataset.mockRejectedValueOnce(new Error("503"));
      const { result } = renderSearch();
      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["old"]),
      );

      act(() => result.current.onSearchTermChange("rain in Crete"));
      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() =>
        expect(result.current.error).toBe(ApiErrorMessage.SMART_SEARCH_FAILED),
      );
      expect(result.current.datasets).toEqual([]);
    });

    it("ignores a failure that arrives after a newer search succeeded", async () => {
      const { result } = renderSearch();
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
      let failRain: (err: Error) => void = () => {};
      api.queryDatasets.mockImplementationOnce(
        () => new Promise((_, reject) => (failRain = reject)),
      );
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ id: "snow", name: "Snow" }],
        count: 1,
      });

      act(() => result.current.onSearchTermSubmit("rain"));
      act(() => result.current.onSearchTermSubmit("snow"));
      await waitFor(() =>
        expect(result.current.datasets.map((d) => d.id)).toEqual(["snow"]),
      );
      await act(async () => failRain(new Error("timeout")));

      expect(result.current.error).toBeNull();
      expect(result.current.datasets.map((d) => d.id)).toEqual(["snow"]);
    });

    it("reports a failed custom collection the same way", async () => {
      api.queryUserCollections.mockRejectedValue(
        new Error("Server error (500): stack trace"),
      );
      const { result } = renderSearch({ kind: "custom", id: "mine" });

      await waitFor(() =>
        expect(result.current.error).toBe("Failed to fetch datasets"),
      );
    });

    it("says which step failed when a custom collection's details fail", async () => {
      api.queryUserCollections.mockResolvedValue({
        items: [{ id: "mine", datasets: [{ id: "a" }] }],
      });
      api.queryDatasets.mockRejectedValue(new Error("500"));
      const { result } = renderSearch({ kind: "custom", id: "mine" });

      await waitFor(() =>
        expect(result.current.error).toBe(
          ApiErrorMessage.FETCH_DATASET_DETAILS_FAILED,
        ),
      );
      expect(result.current.datasets).toEqual([]);
    });

    it("asks the user to sign in again without a token and requests nothing", async () => {
      api.hasToken = false;
      const { result } = renderSearch();

      await waitFor(() =>
        expect(result.current.error).toBe(ApiErrorMessage.NO_AUTH_TOKEN_FOUND),
      );
      expect(api.queryDatasets).not.toHaveBeenCalled();
    });

    it("tries again after a failure even when nothing else changed", async () => {
      api.queryDatasets.mockRejectedValueOnce(new Error("500"));
      const { result } = renderSearch();
      await waitFor(() =>
        expect(result.current.error).toBe("Failed to fetch datasets"),
      );

      // An empty box: the Smart toggle leaves the catalogue request as it was.
      act(() => result.current.onSmartSearchToggle(true));

      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.error).toBeNull());
    });
  });

  describe("load more", () => {
    it("keeps every dataset already listed", async () => {
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ name: "No id" }],
        count: 2,
      });
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ id: "b", name: "B" }],
        count: 2,
      });
      const { result } = renderSearch();
      await waitFor(() => expect(result.current.hasMore).toBe(true));

      await act(async () => result.current.onLoadMore());

      expect(result.current.datasets.map((d) => d.title)).toEqual([
        "B",
        "No id",
      ]);
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
