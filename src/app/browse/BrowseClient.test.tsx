import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
const router = { push, replace };
let params = new URLSearchParams();

const api = {
  hasToken: true,
  persistConversation: vi.fn(),
  searchCrossDataset: vi.fn(),
  queryDatasets: vi.fn(),
  queryUserCollections: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/browse",
  useSearchParams: () => params,
}));

vi.mock("@/hooks/useApi", () => ({ useApi: () => api }));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    apiCollections: [],
    extraCollections: [],
    refreshExtraCollections: vi.fn(),
    notifyCollectionModified: vi.fn(),
  }),
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CreateCollectionModal", () => ({ default: () => null }));

vi.mock("@/components/Browse", () => ({
  default: (props: {
    searchTerm: string;
    isSmartSearchEnabled: boolean;
    onSearchTermSubmit: (value?: string) => void;
    onSearchTermChange?: (value: string) => void;
    onSmartSearchToggle?: (enabled: boolean) => void;
    datasets: unknown[];
    totalCount?: number;
    hasMore?: boolean;
    onLoadMore?: () => void;
    error?: string | null;
    loadMoreError?: string | null;
    appliedSearchTerm?: string;
    onApplyFilters?: (filters: unknown) => void;
    onSortByChange?: (value: string) => void;
  }) => (
    <div>
      {props.error && <p data-testid="error">{props.error}</p>}
      <span data-testid="applied">{props.appliedSearchTerm}</span>
      {props.loadMoreError && (
        <p data-testid="load-more-error">{props.loadMoreError}</p>
      )}
      <button type="button" onClick={() => props.onSearchTermChange?.("ab")}>
        Type ab
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
      <button
        type="button"
        onClick={() => props.onSortByChange?.("datePublished-desc")}
      >
        Sort newest
      </button>
      <span data-testid="shown">{props.datasets.length}</span>
      <span data-testid="access">
        {(props.datasets as { access?: string }[])
          .map((d) => d.access ?? "none")
          .join(",")}
      </span>
      <span data-testid="total">{String(props.totalCount)}</span>
      {props.hasMore && (
        <button type="button" onClick={() => props.onLoadMore?.()}>
          Load more datasets
        </button>
      )}
      <input aria-label="Search" readOnly value={props.searchTerm} />
      <span data-testid="smart">{String(props.isSmartSearchEnabled)}</span>
      <button
        type="button"
        onClick={() => props.onSearchTermSubmit("nursing data")}
      >
        Search again
      </button>
      <button
        type="button"
        onClick={() => props.onSearchTermSubmit("  rain  ")}
      >
        Search padded
      </button>
      <button
        type="button"
        onClick={() => props.onSearchTermChange?.("air quality")}
      >
        Type air quality
      </button>
      <button
        type="button"
        onClick={() => props.onSmartSearchToggle?.(!props.isSmartSearchEnabled)}
      >
        Toggle Smart search
      </button>
    </div>
  ),
}));

import { handoffStore } from "@/lib/intentRouting/handoffStore";
import BrowseClient from "./BrowseClient";

const handOff = (
  retrievalQuery: string | null = "education Greece",
  originalQuery = "Do you have any datasets about education in Greece?",
) => {
  const id = handoffStore.create({
    originalQuery,
    retrievalQuery,
    intent: "dataset_search",
    chosenBy: "classifier",
  });
  params = new URLSearchParams({ handoff: id });
  return id;
};

const crossDatasetQueries = () =>
  api.searchCrossDataset.mock.calls.map(([payload]) => payload.query);

describe("BrowseClient – Home handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = new URLSearchParams();
    api.persistConversation.mockResolvedValue({ id: "conv-1" });
    api.searchCrossDataset.mockResolvedValue({ result: [] });
    api.queryDatasets.mockResolvedValue({ items: [] });
  });

  it("opens the catalogue without Smart Search on direct entry", async () => {
    render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalled());
    expect(api.searchCrossDataset).not.toHaveBeenCalled();
    expect(screen.getByTestId("smart")).toHaveTextContent("false");
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("shows the original text and discovers once with the retrieval query", async () => {
    handOff();
    render(<BrowseClient />);

    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(crossDatasetQueries()).toEqual(["education Greece"]);
    // A dataset search is not a chat: nothing is stored in a conversation.
    expect(api.persistConversation).not.toHaveBeenCalled();
    expect(api.searchCrossDataset.mock.calls[0][0].conversationOptions).toEqual(
      {
        autoCreateConversation: false,
      },
    );
    expect(screen.getByLabelText("Search")).toHaveValue(
      "Do you have any datasets about education in Greece?",
    );
    expect(screen.getByTestId("smart")).toHaveTextContent("true");
    expect(api.queryDatasets).not.toHaveBeenCalled();
  });

  it("discovers once under StrictMode double effects", async () => {
    handOff();
    render(
      <StrictMode>
        <BrowseClient />
      </StrictMode>,
    );
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    await act(async () => {});
    expect(api.searchCrossDataset).toHaveBeenCalledTimes(1);
    expect(api.persistConversation).not.toHaveBeenCalled();
  });

  it("falls back to the original text when there is no retrieval query", async () => {
    handOff(null);
    render(<BrowseClient />);
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(crossDatasetQueries()).toEqual([
      "Do you have any datasets about education in Greece?",
    ]);
  });

  it("consumes the handoff and removes it from the URL", async () => {
    const id = handOff();
    render(<BrowseClient />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/browse"));
    expect(handoffStore.peek(id)).toBeNull();
  });

  it("does not search again when mounted again for the same handoff", async () => {
    handOff();
    const first = render(<BrowseClient />);
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );
    first.unmount();

    render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalled());
    expect(api.searchCrossDataset).toHaveBeenCalledTimes(1);
  });

  it("ignores an unknown or expired handoff id", async () => {
    params = new URLSearchParams({ handoff: "not-a-real-id" });
    render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalled());
    expect(api.searchCrossDataset).not.toHaveBeenCalled();
  });

  it("searches with the user's new text after they search again", async () => {
    handOff();
    render(<BrowseClient />);
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search again" }));
    });
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(2),
    );
    expect(crossDatasetQueries()[1]).toBe("nursing data");
    expect(api.persistConversation).not.toHaveBeenCalled();
    expect(api.searchCrossDataset.mock.calls[1][0].conversationOptions).toEqual(
      {
        autoCreateConversation: false,
      },
    );
  });

  it("trims the submitted search text", async () => {
    render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search padded" }));
    });
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    expect(api.queryDatasets.mock.calls[1][0].like).toBe("%rain%");
  });

  it("searches again when the same text is submitted again", async () => {
    render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    const submit = () =>
      act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Search padded" }));
      });
    await submit();
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    await submit();
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(3));
    expect(api.queryDatasets.mock.calls[2][0].like).toBe("%rain%");
  });

  it("runs Smart search again when the same text is submitted again", async () => {
    handOff();
    render(<BrowseClient />);
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );
    const again = () =>
      act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Search again" }));
      });
    await again();
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(2),
    );
    await again();
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(3),
    );
  });

  const click = (name: string) =>
    act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
    });

  it("searches the text in the box when Smart search is switched", async () => {
    render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

    await click("Type air quality");
    await click("Toggle Smart search");
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );
    expect(crossDatasetQueries()).toEqual(["air quality"]);

    await click("Toggle Smart search");
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(2));
    expect(api.queryDatasets.mock.calls[1][0].like).toBe("%air quality%");
  });

  it("runs Smart search again when switched back on after a Home handoff", async () => {
    handOff();
    render(<BrowseClient />);
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );

    await click("Toggle Smart search");
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));
    await click("Toggle Smart search");
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(2),
    );
    expect(crossDatasetQueries()[1]).toBe("education Greece");
  });

  it("asks for a collection's datasets when one is opened after a handoff", async () => {
    handOff();
    const { rerender } = render(<BrowseClient />);
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());

    params = new URLSearchParams({ collection: "col-9" });
    rerender(<BrowseClient />);

    await waitFor(() =>
      expect(
        api.queryDatasets.mock.calls.some(
          ([p]) => p.collectionIds?.[0] === "col-9",
        ),
      ).toBe(true),
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
      items: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      count: 3,
    });
    handOff();
    render(<BrowseClient />);
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Toggle Smart search" }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId("shown")).toHaveTextContent("3"),
    );
    await act(async () => {
      answerSmart({ result: [{ dataset: { id: "s1", name: "Late" } }] });
    });

    expect(screen.getByTestId("shown")).toHaveTextContent("3");
    expect(screen.getByTestId("smart")).toHaveTextContent("false");
  });

  it("ignores a late Smart search failure after switching Smart search off", async () => {
    let failSmart: (reason: unknown) => void = () => {};
    api.searchCrossDataset.mockReturnValueOnce(
      new Promise((_, reject) => {
        failSmart = reject;
      }),
    );
    api.queryDatasets.mockResolvedValue({ items: [{ id: "c1" }], count: 1 });
    handOff();
    render(<BrowseClient />);
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Toggle Smart search" }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId("shown")).toHaveTextContent("1"),
    );
    const catalogueCalls = api.queryDatasets.mock.calls.length;
    await act(async () => {
      failSmart(new Error("timeout"));
    });

    expect(screen.queryByTestId("error")).toBeNull();
    expect(api.queryDatasets.mock.calls.length).toBe(catalogueCalls);
    expect(screen.getByTestId("shown")).toHaveTextContent("1");
  });

  it("reports a failed Smart search instead of showing no results", async () => {
    api.searchCrossDataset.mockRejectedValueOnce(new Error("timeout"));
    handOff();
    render(<BrowseClient />);

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Smart search is not available right now.",
      ),
    );
    expect(api.queryDatasets).not.toHaveBeenCalled();
  });

  it("runs Smart search for a short query with a longer retrieval query", async () => {
    handOff("United Kingdom", "UK");
    render(<BrowseClient />);

    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(crossDatasetQueries()).toEqual(["United Kingdom"]);
    expect(screen.getByLabelText("Search")).toHaveValue("UK");
  });

  it("applies one or two characters in the box when Smart search is switched", async () => {
    render(<BrowseClient />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search padded" }));
    });
    await waitFor(() =>
      expect(api.queryDatasets.mock.calls.at(-1)?.[0].like).toBe("%rain%"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Type ab" }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Toggle Smart search" }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("smart")).toHaveTextContent("true"),
    );
    expect(api.searchCrossDataset).not.toHaveBeenCalled();
    expect(api.queryDatasets.mock.calls.at(-1)?.[0].like).toBeUndefined();
    // Nothing was searched, so the page must not describe a search.
    expect(screen.getByTestId("applied")).toHaveTextContent("");
  });

  it("does not apply hidden filters or sort while Smart search lists the catalogue", async () => {
    render(<BrowseClient />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Filter by licence" }),
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sort newest" }));
    });
    await waitFor(() =>
      expect(api.queryDatasets.mock.calls.at(-1)?.[0].license).toBe(
        "cc-by-4.0",
      ),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Toggle Smart search" }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("smart")).toHaveTextContent("true"),
    );
    const last = api.queryDatasets.mock.calls.at(-1)?.[0];
    expect(last.license).toBeUndefined();
    expect(last.Order).toEqual({ Items: ["+name"] });
  });

  it("ignores a late reply for the custom collection opened before", async () => {
    let answerA: (value: unknown) => void = () => {};
    api.queryUserCollections
      .mockResolvedValueOnce({ items: [{ id: "A", datasets: [{ id: "a1" }] }] })
      .mockResolvedValueOnce({
        items: [{ id: "B", datasets: [{ id: "b1" }, { id: "b2" }] }],
      });
    api.queryDatasets
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerA = resolve;
        }),
      )
      .mockResolvedValueOnce({ items: [{ id: "b1" }, { id: "b2" }] });
    params = new URLSearchParams({ collection: "A", isCustom: "true" });
    const { rerender } = render(<BrowseClient />);
    await waitFor(() => expect(api.queryDatasets).toHaveBeenCalledTimes(1));

    params = new URLSearchParams({ collection: "B", isCustom: "true" });
    rerender(<BrowseClient />);
    await waitFor(() =>
      expect(screen.getByTestId("shown")).toHaveTextContent("2"),
    );
    await act(async () => {
      answerA({ items: [{ id: "a1" }] });
    });

    expect(screen.getByTestId("shown")).toHaveTextContent("2");
  });

  it("claims no access for a Smart result the user can browse", async () => {
    handOff();
    api.searchCrossDataset.mockResolvedValue({
      result: [
        {
          dataset: { id: "s1", name: "Rain", permissions: ["browsedataset"] },
          maxSimilarity: 0.9,
        },
      ],
    });
    render(<BrowseClient />);

    await waitFor(() =>
      expect(screen.getByTestId("shown")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("access")).toHaveTextContent("none");
  });

  it("takes a custom collection's access from the dataset, not Open Access for all", async () => {
    api.queryUserCollections.mockResolvedValue({
      items: [{ id: "A", datasets: [{ id: "a1" }, { id: "a2" }] }],
    });
    api.queryDatasets.mockResolvedValue({
      items: [
        { id: "a1", name: "One", permissions: ["browsedataset"] },
        { id: "a2", name: "Two" },
      ],
    });
    params = new URLSearchParams({ collection: "A", isCustom: "true" });
    render(<BrowseClient />);

    await waitFor(() =>
      expect(screen.getByTestId("shown")).toHaveTextContent("2"),
    );
    expect(screen.getByTestId("access")).toHaveTextContent("none,none");
  });

  it("runs Smart search with the user's text when the retrieval query is too short", async () => {
    handOff("AI");
    render(<BrowseClient />);

    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(crossDatasetQueries()).toEqual([
      "Do you have any datasets about education in Greece?",
    ]);
    expect(api.queryDatasets).not.toHaveBeenCalled();
  });

  describe("catalogue paging", () => {
    const item = (n: number) => ({
      id: `d${n}`,
      name: `Dataset ${String(n).padStart(3, "0")}`,
    });
    const items = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => item(from + i));

    it("loads 25 at a time with the same search, filters and sort", async () => {
      api.queryDatasets
        .mockResolvedValueOnce({ items: items(1, 25), count: 40 })
        .mockResolvedValueOnce({ items: items(26, 40), count: 40 });
      render(<BrowseClient />);

      await waitFor(() =>
        expect(screen.getByTestId("shown")).toHaveTextContent("25"),
      );
      expect(screen.getByTestId("total")).toHaveTextContent("40");
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Load more datasets" }),
        );
      });

      await waitFor(() =>
        expect(screen.getByTestId("shown")).toHaveTextContent("40"),
      );
      const [first, second] = api.queryDatasets.mock.calls.map(([p]) => p);
      expect(first.page).toEqual({ Offset: 0, Size: 25 });
      expect(second.page).toEqual({ Offset: 25, Size: 25 });
      expect({ ...second, page: undefined }).toEqual({
        ...first,
        page: undefined,
      });
      expect(
        screen.queryByRole("button", { name: "Load more datasets" }),
      ).toBeNull();
    });

    it("asks the Gateway for a built-in collection's datasets", async () => {
      params = new URLSearchParams({ collection: "col-1" });
      api.queryDatasets.mockResolvedValueOnce({
        items: [{ ...item(1), collections: [{ id: "col-1", name: "C" }] }],
        count: 30,
      });
      render(<BrowseClient />);
      await waitFor(() => expect(api.queryDatasets).toHaveBeenCalled());
      expect(api.queryDatasets.mock.calls[0][0].collectionIds).toEqual([
        "col-1",
      ]);
      await waitFor(() =>
        expect(screen.getByTestId("total")).toHaveTextContent("30"),
      );
    });

    it("keeps the list and reports a failed load more beside the button", async () => {
      api.queryDatasets
        .mockResolvedValueOnce({ items: items(1, 25), count: 40 })
        .mockRejectedValueOnce(new Error("Server error (502): upstream"));
      render(<BrowseClient />);
      await waitFor(() =>
        expect(screen.getByTestId("shown")).toHaveTextContent("25"),
      );
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Load more datasets" }),
        );
      });

      await waitFor(() =>
        expect(screen.getByTestId("load-more-error")).toHaveTextContent(
          "Couldn't load more datasets. Try again.",
        ),
      );
      expect(screen.queryByTestId("error")).toBeNull();
      expect(screen.getByTestId("shown")).toHaveTextContent("25");
      expect(
        screen.getByRole("button", { name: "Load more datasets" }),
      ).toBeInTheDocument();
    });

    it("does not offer more when everything is shown", async () => {
      api.queryDatasets.mockResolvedValueOnce({
        items: items(1, 20),
        count: 20,
      });
      render(<BrowseClient />);
      await waitFor(() =>
        expect(screen.getByTestId("shown")).toHaveTextContent("20"),
      );
      expect(
        screen.queryByRole("button", { name: "Load more datasets" }),
      ).toBeNull();
    });
  });
});
