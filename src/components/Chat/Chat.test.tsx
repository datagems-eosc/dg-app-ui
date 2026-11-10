import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push, replace: vi.fn() };

const api: Record<string, unknown> & {
  persistConversation: ReturnType<typeof vi.fn>;
  searchCrossDataset: ReturnType<typeof vi.fn>;
  searchInDataExplore: ReturnType<typeof vi.fn>;
} = {
  hasToken: true,
  persistConversation: vi.fn(),
  searchCrossDataset: vi.fn(),
  searchInDataExplore: vi.fn(),
};
const apiProxy = new Proxy(api, {
  get(target, key: string) {
    if (!(key in target)) target[key] = vi.fn().mockResolvedValue({});
    return target[key];
  },
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useApi", () => ({ useApi: () => apiProxy }));
vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    apiCollections: [],
    collections: [],
    extraCollections: [],
    isLoading: false,
  }),
}));
vi.mock("@ui/chat/ChatInput", () => ({
  ChatInput: (props: {
    value: string;
    onChange: (v: string) => void;
    onSend: (e?: unknown) => void;
    onSelectCollection?: (c: unknown) => void;
    placeholder?: string;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          props.onSelectCollection?.({ id: "col-7", name: "Weather" })
        }
      >
        Pick collection
      </button>
      <input
        aria-label="Message"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <button type="button" onClick={props.onSend}>
        Send
      </button>
    </div>
  ),
}));
vi.mock("@ui/chat/ChatMessages", () => ({
  default: ({
    messages,
  }: {
    messages: { id: string; content: string; recommendations?: string[] }[];
  }) => (
    <ul>
      {messages.map((m) => (
        <li key={m.id}>
          {m.content}
          {m.recommendations?.map((r) => (
            <span key={r}>Suggestion: {r}</span>
          ))}
          {m.recommendations ? <span>Suggestions settled</span> : null}
        </li>
      ))}
    </ul>
  ),
}));
vi.mock("@ui/chat/ChatInitialView", () => ({ default: () => null }));
vi.mock("@ui/chat/ChatMessagesSkeleton", () => ({
  ChatMessagesSkeleton: () => null,
}));
vi.mock("@ui/chat/DatasetChangeWarning", () => ({ default: () => null }));
vi.mock("../SelectedDatasetsPanel", () => ({
  default: ({
    selectedDatasetIds,
    datasets,
  }: {
    selectedDatasetIds: string[];
    datasets: { id: string; name?: string; title?: string }[];
  }) => (
    <ul aria-label="Selected datasets panel">
      {selectedDatasetIds.map((id) => {
        const found = datasets.find((d) => d.id === id);
        return <li key={id}>{found ? `Details: ${id}` : `Missing: ${id}`}</li>;
      })}
    </ul>
  ),
}));
vi.mock("../AddDatasetsModal", () => ({ default: () => null }));

import { handoffStore } from "@/lib/intentRouting/handoffStore";
import Chat from "./Chat";

const crossDatasetResult = {
  result: [{ dataset: { id: "ds-1", code: "c", name: "Basel weather" } }],
};

const renderChat = (props: Partial<React.ComponentProps<typeof Chat>> = {}) =>
  render(
    <Chat
      selectedDatasets={[]}
      onSelectedDatasetsChange={vi.fn()}
      conversationId={null}
      initialMessages={undefined}
      {...props}
    />,
  );

describe("Chat – first question without datasets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    api.persistConversation.mockResolvedValue({ id: "conv-1" });
    api.searchCrossDataset.mockResolvedValue(crossDatasetResult);
  });

  it("creates one conversation, discovers with the typed text and proposes datasets", async () => {
    renderChat();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "average rainfall in Basel" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chat/conv-1"));
    expect(api.persistConversation).toHaveBeenCalledTimes(1);
    expect(api.persistConversation.mock.calls[0][0]).toEqual({
      name: "average rainfall in Basel",
    });
    expect(api.searchCrossDataset).toHaveBeenCalledTimes(1);
    expect(api.searchCrossDataset.mock.calls[0][0]).toMatchObject({
      query: "average rainfall in Basel",
      conversationOptions: {
        conversationId: "conv-1",
        autoCreateConversation: false,
      },
    });
    expect(screen.getByText("average rainfall in Basel")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This dataset looks relevant to your question. Use it to answer?",
      ),
    ).toBeInTheDocument();
  });
});

describe("Chat – follow-up suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    api.persistConversation.mockResolvedValue({ id: "conv-1" });
    api.searchCrossDataset.mockResolvedValue(crossDatasetResult);
  });

  const ask = async () => {
    renderChat();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "average rainfall in Basel" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    await screen.findByText("Suggestions settled", undefined, {
      timeout: 3000,
    });
  };

  it("shows the suggestions the Gateway returns", async () => {
    api.getRecommendNextQueries = vi
      .fn()
      .mockResolvedValue({ result: [{ query: "Rainfall in Zurich" }] });

    await ask();

    expect(
      screen.getByText("Suggestion: Rainfall in Zurich"),
    ).toBeInTheDocument();
  });

  it("shows no made-up suggestions when the Gateway call fails", async () => {
    api.getRecommendNextQueries = vi
      .fn()
      .mockRejectedValue(new Error("System error"));

    await ask();

    expect(screen.queryByText(/^Suggestion:/)).not.toBeInTheDocument();
  });

  it("shows no made-up suggestions when the Gateway returns none", async () => {
    api.getRecommendNextQueries = vi.fn().mockResolvedValue({ result: [] });

    await ask();

    expect(screen.queryByText(/^Suggestion:/)).not.toBeInTheDocument();
  });
});

describe("Chat – selected dataset details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    api.queryDatasets = vi.fn(async (payload: { ids?: string[] }) => ({
      items: (payload.ids ?? []).map((id) => ({ id, name: id })),
    }));
  });

  it("loads details for the selected datasets by id", async () => {
    renderChat({ selectedDatasets: ["ds-1", "ds-2"] });

    expect(await screen.findByText("Details: ds-2")).toBeInTheDocument();
    expect(screen.getByText("Details: ds-1")).toBeInTheDocument();
    const payloads = (
      api.queryDatasets as ReturnType<typeof vi.fn>
    ).mock.calls.map(([payload]) => payload);
    expect(payloads.every((p) => Array.isArray(p.ids))).toBe(true);
  });
});

describe("Chat – input placeholder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("offers to find datasets when none are selected", () => {
    renderChat();

    expect(screen.getByLabelText("Message")).toHaveAttribute(
      "placeholder",
      "Ask a question and I'll find datasets to answer it...",
    );
  });

  it("names the count when several datasets are selected", () => {
    renderChat({ selectedDatasets: ["ds-1", "ds-2", "ds-3"] });

    expect(screen.getByLabelText("Message")).toHaveAttribute(
      "placeholder",
      "Ask about your 3 selected datasets...",
    );
  });

  it("uses the singular wording for one selected dataset", () => {
    renderChat({ selectedDatasets: ["ds-1"] });

    expect(screen.getByLabelText("Message")).toHaveAttribute(
      "placeholder",
      "Ask about your selected dataset...",
    );
  });
});

describe("Chat – Home handoff", () => {
  const ORIGINAL = "What was the mean temperature in Athens in July 2024?";

  const handOff = () => {
    const id = handoffStore.create({
      originalQuery: ORIGINAL,
      retrievalQuery: "Athens temperature 2024",
      intent: "question",
      chosenBy: "classifier",
    });
    return { id, originalQuery: ORIGINAL };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    api.persistConversation.mockResolvedValue({ id: "conv-9" });
    api.searchCrossDataset.mockResolvedValue(crossDatasetResult);
  });

  it("submits the original question once, after dropping the handoff from the URL", async () => {
    renderChat({ initialHandoff: handOff() });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chat/conv-9"));
    expect(router.replace).toHaveBeenCalledWith("/chat");
    expect(router.replace.mock.invocationCallOrder[0]).toBeLessThan(
      api.persistConversation.mock.invocationCallOrder[0],
    );
    expect(api.persistConversation).toHaveBeenCalledTimes(1);
    expect(api.persistConversation.mock.calls[0][0]).toEqual({
      name: ORIGINAL,
    });
    expect(screen.getByText(ORIGINAL)).toBeInTheDocument();
  });

  it("discovers with the original question, which Gateway stores for analysis", async () => {
    renderChat({ initialHandoff: handOff() });
    await waitFor(() =>
      expect(api.searchCrossDataset).toHaveBeenCalledTimes(1),
    );
    expect(api.searchCrossDataset.mock.calls[0][0].query).toBe(ORIGINAL);
  });

  it("submits once even when mounted again for the same handoff", async () => {
    const handoff = handOff();
    const first = renderChat({ initialHandoff: handoff });
    await waitFor(() =>
      expect(api.persistConversation).toHaveBeenCalledTimes(1),
    );
    first.unmount();
    renderChat({ initialHandoff: handoff });
    await act(async () => {});
    expect(api.persistConversation).toHaveBeenCalledTimes(1);
  });

  it("keeps the question in the box when the handoff submission fails", async () => {
    api.persistConversation.mockRejectedValueOnce(new Error("unavailable"));
    renderChat({ initialHandoff: handOff() });

    await waitFor(() =>
      expect(api.persistConversation).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(ORIGINAL),
    );
  });

  it("waits for authentication before submitting", async () => {
    api.hasToken = false;
    const handoff = handOff();
    const view = renderChat({ initialHandoff: handoff });
    await act(async () => {});
    expect(api.persistConversation).not.toHaveBeenCalled();

    api.hasToken = true;
    view.rerender(
      <Chat
        selectedDatasets={[]}
        onSelectedDatasetsChange={vi.fn()}
        conversationId={null}
        initialMessages={undefined}
        initialHandoff={handoff}
      />,
    );
    await waitFor(() =>
      expect(api.persistConversation).toHaveBeenCalledTimes(1),
    );
  });
});

describe("Chat – collection selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("asks the Gateway for the collection's datasets with collectionIds", async () => {
    const queryDatasets = vi.fn().mockResolvedValue({
      items: [{ id: "ds-a" }, { id: "ds-b" }],
      count: 2,
    });
    api.queryDatasets = queryDatasets;
    const onSelectedDatasetsChange = vi.fn();
    renderChat({ onSelectedDatasetsChange });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pick collection" }));
    });

    await waitFor(() => expect(queryDatasets).toHaveBeenCalledTimes(1));
    const payload = queryDatasets.mock.calls[0][0];
    expect(payload.collectionIds).toEqual(["col-7"]);
    expect(payload).not.toHaveProperty("collections");
    await waitFor(() =>
      expect(onSelectedDatasetsChange).toHaveBeenCalledWith(["ds-a", "ds-b"]),
    );
  });
});
