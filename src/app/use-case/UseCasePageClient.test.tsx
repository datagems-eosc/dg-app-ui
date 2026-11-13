import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = {
  hasToken: true,
  persistConversation: vi.fn(),
  searchCrossDataset: vi.fn(),
  queryDatasets: vi.fn(),
  queryUserCollections: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/use-case/math/datasets",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useApi", () => ({ useApi: () => api }));

type TestCollection = { id: string; name: string };
// Like the real context: `collections` is the built-in list plus the user's.
const collectionsState = {
  apiCollections: [{ id: "col-math", name: "Math" }] as TestCollection[],
  extraCollections: [] as TestCollection[],
  get collections() {
    return [...this.apiCollections, ...this.extraCollections];
  },
  isLoadingApiCollections: false,
  apiCollectionsFailed: false,
};
vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => collectionsState,
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CreateCollectionModal", () => ({ default: () => null }));

vi.mock("@/components/Browse", () => ({
  default: (props: {
    onSmartSearchToggle: (enabled: boolean) => void;
    onSearchTermSubmit: (value?: string) => void;
    onSearchTermChange: (value: string) => void;
    onSortByChange?: (value: string) => void;
    onApplyFilters?: (filters: unknown) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    error?: string | null;
    datasets: { id: string; access?: string }[];
  }) => (
    <div>
      {props.error && <p data-testid="error">{props.error}</p>}
      <span data-testid="shown">{props.datasets.length}</span>
      <span data-testid="access">
        {props.datasets.map((d) => d.access ?? "none").join(",")}
      </span>
      <button type="button" onClick={() => props.onSearchTermChange("ab")}>
        Type ab
      </button>
      <button type="button" onClick={() => props.onSmartSearchToggle(false)}>
        Smart off
      </button>
      <button
        type="button"
        onClick={() => props.onSearchTermChange("air quality")}
      >
        Type air quality
      </button>
      <button type="button" onClick={() => props.onSmartSearchToggle(true)}>
        Smart on
      </button>
      <button
        type="button"
        onClick={() => props.onSearchTermSubmit("rainfall in Crete")}
      >
        Search
      </button>
      <button
        type="button"
        onClick={() => props.onSortByChange?.("datePublished-desc")}
      >
        Sort newest
      </button>
      <button
        type="button"
        onClick={() =>
          props.onApplyFilters?.({
            access: "",
            creationYear: { start: "", end: "" },
            datasetSize: { start: "", end: "" },
            fieldsOfScience: [],
            license: ["cc-by-4.0"],
          })
        }
      >
        Filter by licence
      </button>
      {props.hasMore && (
        <button type="button" onClick={() => props.onLoadMore?.()}>
          Load more datasets
        </button>
      )}
    </div>
  ),
}));

import UseCasePageClient from "./UseCasePageClient";

const mathItem = (id: string) => ({
  id,
  name: id,
  permissions: ["browsedataset"],
  collections: [{ id: "col-math", name: "Math" }],
});
const mathItems = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => mathItem(`m${from + i}`));

const renderMath = () =>
  render(<UseCasePageClient collectionName="Math" title="Math" subtitle="" />);

const click = (view: ReturnType<typeof render>, name: string) =>
  act(async () => {
    fireEvent.click(view.getByRole("button", { name }));
  });

const catalogueCalls = () => api.queryDatasets.mock.calls.map(([p]) => p);

beforeEach(() => {
  vi.clearAllMocks();
  collectionsState.apiCollections = [{ id: "col-math", name: "Math" }];
  collectionsState.extraCollections = [];
  collectionsState.isLoadingApiCollections = false;
  collectionsState.apiCollectionsFailed = false;
  api.persistConversation.mockResolvedValue({ id: "conv-1" });
  api.searchCrossDataset.mockResolvedValue({ result: [] });
  api.queryDatasets.mockResolvedValue({ items: [] });
});

describe("UseCasePageClient – opening", () => {
  it("lists the use case's collection once, after the collection is known", async () => {
    collectionsState.apiCollections = [];
    collectionsState.isLoadingApiCollections = true;
    const view = renderMath();
    await act(async () => {});
    expect(api.queryDatasets).not.toHaveBeenCalled();

    collectionsState.apiCollections = [{ id: "col-math", name: "Math" }];
    collectionsState.isLoadingApiCollections = false;
    view.rerender(
      <UseCasePageClient collectionName="Math" title="Math" subtitle="" />,
    );

    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(api.queryDatasets).toHaveBeenCalledTimes(1);
    expect(catalogueCalls()[0].collectionIds).toEqual(["col-math"]);
    expect(catalogueCalls()[0].page).toEqual({ Offset: 0, Size: 25 });
  });

  it("reports an unknown collection and lists nothing", async () => {
    collectionsState.apiCollections = [{ id: "col-x", name: "Weather" }];
    const view = renderMath();

    await waitFor(() =>
      expect(view.getByTestId("error")).toHaveTextContent(
        "The Math collection could not be found.",
      ),
    );
    expect(api.queryDatasets).not.toHaveBeenCalled();
    expect(view.getByTestId("shown")).toHaveTextContent("0");
  });

  it("says the collections failed to load rather than that the collection is missing", async () => {
    collectionsState.apiCollections = [];
    collectionsState.apiCollectionsFailed = true;
    const view = renderMath();

    await waitFor(() =>
      expect(view.getByTestId("error")).toHaveTextContent(
        "Failed to fetch collections",
      ),
    );
    expect(api.queryDatasets).not.toHaveBeenCalled();
    expect(view.getByTestId("shown")).toHaveTextContent("0");
  });

  it("does not take the user's own collection of the same name for the use case", async () => {
    collectionsState.apiCollections = [{ id: "col-x", name: "Weather" }];
    collectionsState.extraCollections = [{ id: "mine", name: "Math" }];
    const view = renderMath();

    await waitFor(() =>
      expect(view.getByTestId("error")).toHaveTextContent(
        "The Math collection could not be found.",
      ),
    );
    expect(api.queryDatasets).not.toHaveBeenCalled();
  });

  it("shows each dataset's own access, not one guessed from permissions", async () => {
    api.queryDatasets.mockResolvedValue({ items: mathItems(1, 2), count: 2 });
    const view = renderMath();

    await waitFor(() =>
      expect(view.getByTestId("shown")).toHaveTextContent("2"),
    );
    expect(view.getByTestId("access")).toHaveTextContent("none,none");
  });
});

describe("UseCasePageClient – searching like Datasets", () => {
  it("searches by keyword on the server within the collection", async () => {
    const view = renderMath();
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    api.queryDatasets.mockResolvedValueOnce({ items: [mathItem("rain")] });

    await click(view, "Search");

    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    expect(catalogueCalls()[1]).toMatchObject({
      like: "%rainfall in Crete%",
      collectionIds: ["col-math"],
    });
    await waitFor(() =>
      expect(view.getByTestId("shown")).toHaveTextContent("1"),
    );
  });

  it("sorts on the server", async () => {
    const view = renderMath();
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

    await click(view, "Sort newest");

    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    expect(catalogueCalls()[1].Order).toEqual({ Items: ["-datePublished"] });
    expect(catalogueCalls()[1].collectionIds).toEqual(["col-math"]);
  });

  it("filters on the server within the collection", async () => {
    const view = renderMath();
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    api.queryDatasets.mockResolvedValueOnce({ items: [mathItem("cc")] });

    await click(view, "Filter by licence");

    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    expect(catalogueCalls()[1]).toMatchObject({
      license: "cc-by-4.0",
      collectionIds: ["col-math"],
    });
    await waitFor(() =>
      expect(view.getByTestId("shown")).toHaveTextContent("1"),
    );
  });

  it("loads more datasets of the collection", async () => {
    api.queryDatasets
      .mockResolvedValueOnce({ items: mathItems(1, 25), count: 30 })
      .mockResolvedValueOnce({ items: mathItems(26, 30), count: 30 });
    const view = renderMath();
    await waitFor(() =>
      expect(view.getByTestId("shown")).toHaveTextContent("25"),
    );

    await click(view, "Load more datasets");

    await waitFor(() =>
      expect(view.getByTestId("shown")).toHaveTextContent("30"),
    );
    expect(catalogueCalls()[1]).toMatchObject({
      page: { Offset: 25, Size: 25 },
      collectionIds: ["col-math"],
    });
  });
});

describe("UseCasePageClient – Smart search", () => {
  it("searches the collection only, without creating a conversation", async () => {
    const view = renderMath();
    await click(view, "Smart on");
    await click(view, "Search");

    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(api.persistConversation).not.toHaveBeenCalled();
    const payload = api.searchCrossDataset.mock.calls.at(-1)?.[0];
    expect(payload.query).toBe("rainfall in Crete");
    expect(payload.collectionIds).toEqual(["col-math"]);
    expect(payload.conversationOptions).toEqual({
      autoCreateConversation: false,
    });
  });

  it("runs Smart search again when the same text is submitted again", async () => {
    const view = renderMath();
    await click(view, "Smart on");
    await click(view, "Search");
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );
    await click(view, "Search");
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(2),
    );
  });

  it("searches the text in the box when Smart search is switched on", async () => {
    const view = renderMath();
    await click(view, "Type air quality");
    await click(view, "Smart on");
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(api.searchCrossDataset.mock.calls.at(-1)?.[0].query).toBe(
      "air quality",
    );
  });

  it("ignores a late Smart search reply after switching Smart search off", async () => {
    let answerSmart: (value: unknown) => void = () => {};
    api.searchCrossDataset.mockReturnValueOnce(
      new Promise((resolve) => {
        answerSmart = resolve;
      }),
    );
    api.queryDatasets.mockResolvedValue({
      items: [mathItem("m1"), mathItem("m2")],
    });
    const view = renderMath();
    await click(view, "Smart on");
    await click(view, "Search");
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    await click(view, "Smart off");
    await waitFor(() =>
      expect(view.getByTestId("shown")).toHaveTextContent("2"),
    );

    await act(async () => {
      answerSmart({ result: [{ dataset: { id: "s1", name: "Late" } }] });
    });

    expect(view.getByTestId("shown")).toHaveTextContent("2");
  });

  it("applies one or two characters in the box when Smart search is switched", async () => {
    const view = renderMath();
    await click(view, "Smart on");
    await click(view, "Search");
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );
    await click(view, "Type ab");
    await click(view, "Smart off");
    await click(view, "Smart on");

    expect(api.searchCrossDataset).toHaveBeenCalledTimes(1);
  });
});
