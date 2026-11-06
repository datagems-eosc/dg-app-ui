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
    datasets: unknown[];
    totalCount?: number;
    hasMore?: boolean;
    onLoadMore?: () => void;
  }) => (
    <div>
      <span data-testid="shown">{props.datasets.length}</span>
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
    </div>
  ),
}));

import { handoffStore } from "@/lib/intentRouting/handoffStore";
import BrowseClient from "./BrowseClient";

const handOff = (retrievalQuery: string | null = "education Greece") => {
  const id = handoffStore.create({
    originalQuery: "Do you have any datasets about education in Greece?",
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

  describe("catalogue paging", () => {
    const item = (n: number) => ({
      id: `d${n}`,
      name: `Dataset ${String(n).padStart(3, "0")}`,
    });
    const items = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => item(from + i));

    it("loads the next hundred with the same search, filters and sort", async () => {
      api.queryDatasets
        .mockResolvedValueOnce({ items: items(1, 100), count: 150 })
        .mockResolvedValueOnce({ items: items(101, 150), count: 150 });
      render(<BrowseClient />);

      await waitFor(() =>
        expect(screen.getByTestId("shown")).toHaveTextContent("100"),
      );
      expect(screen.getByTestId("total")).toHaveTextContent("150");
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Load more datasets" }),
        );
      });

      await waitFor(() =>
        expect(screen.getByTestId("shown")).toHaveTextContent("150"),
      );
      const [first, second] = api.queryDatasets.mock.calls.map(([p]) => p);
      expect(second.page).toEqual({ Offset: 100, Size: 100 });
      expect({ ...second, page: undefined }).toEqual({
        ...first,
        page: undefined,
      });
      expect(
        screen.queryByRole("button", { name: "Load more datasets" }),
      ).toBeNull();
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
