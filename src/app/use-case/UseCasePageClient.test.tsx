import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = {
  hasToken: true,
  persistConversation: vi.fn(),
  searchCrossDataset: vi.fn(),
  queryDatasets: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/use-case/math/datasets",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useApi", () => ({ useApi: () => api }));

const collections = [{ id: "col-math", name: "Math" }];
vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({ collections }),
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
  }) => (
    <div>
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
    </div>
  ),
}));

import UseCasePageClient from "./UseCasePageClient";

describe("UseCasePageClient – Smart search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.persistConversation.mockResolvedValue({ id: "conv-1" });
    api.searchCrossDataset.mockResolvedValue({ result: [] });
    api.queryDatasets.mockResolvedValue({ items: [] });
  });

  it("searches without creating a conversation", async () => {
    const view = render(
      <UseCasePageClient collectionName="Math" title="Math" subtitle="" />,
    );
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Smart on" }));
    });
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Search" }));
    });

    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(api.persistConversation).not.toHaveBeenCalled();
    const payload = api.searchCrossDataset.mock.calls.at(-1)?.[0];
    expect(payload.query).toBe("rainfall in Crete");
    expect(payload.conversationOptions).toEqual({
      autoCreateConversation: false,
    });
  });

  const click = (view: ReturnType<typeof render>, name: string) =>
    act(async () => {
      fireEvent.click(view.getByRole("button", { name }));
    });

  it("runs Smart search again when the same text is submitted again", async () => {
    const view = render(
      <UseCasePageClient collectionName="Math" title="Math" subtitle="" />,
    );
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
    const view = render(
      <UseCasePageClient collectionName="Math" title="Math" subtitle="" />,
    );
    await click(view, "Type air quality");
    await click(view, "Smart on");
    await waitFor(() => expect(api.searchCrossDataset).toHaveBeenCalled());
    expect(api.searchCrossDataset.mock.calls.at(-1)?.[0].query).toBe(
      "air quality",
    );
  });
});
