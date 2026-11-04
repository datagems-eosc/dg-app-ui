import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
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
  }) => (
    <div>
      <input aria-label="Search" readOnly value={props.searchTerm} />
      <span data-testid="smart">{String(props.isSmartSearchEnabled)}</span>
      <button
        type="button"
        onClick={() => props.onSearchTermSubmit("nursing data")}
      >
        Search again
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
    expect(api.persistConversation).toHaveBeenCalledTimes(1);
    expect(api.persistConversation.mock.calls[0][0]).toEqual({
      name: "Do you have any datasets about education in Greece?",
    });
    expect(screen.getByLabelText("Search")).toHaveValue(
      "Do you have any datasets about education in Greece?",
    );
    expect(screen.getByTestId("smart")).toHaveTextContent("true");
    expect(api.queryDatasets).not.toHaveBeenCalled();
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
  });
});
