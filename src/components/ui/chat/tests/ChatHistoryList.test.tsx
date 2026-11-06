import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatHistoryList } from "../ChatHistoryList";

const mockUseApi = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("../ChatItem", () => ({
  ChatItem: ({
    conversation,
    isActive,
    onConversationUpdate,
    onDeleteConversation,
  }: {
    conversation: { id: string; name?: string; createdAt?: string };
    isActive: boolean;
    onConversationUpdate?: (
      id: string,
      newName: string,
      newETag?: string,
    ) => void;
    onDeleteConversation?: (id: string, name: string) => void;
  }) => (
    <div
      data-testid={`chat-item-${conversation.id}`}
      data-created={conversation.createdAt}
    >
      <span>{conversation.name || "Untitled Conversation"}</span>
      {isActive && <span data-testid="active-indicator">Active</span>}
      <button
        data-testid={`update-${conversation.id}`}
        onClick={() =>
          onConversationUpdate?.(conversation.id, "New Name", "new-etag")
        }
      >
        Update
      </button>
      <button
        data-testid={`delete-${conversation.id}`}
        onClick={() =>
          onDeleteConversation?.(
            conversation.id,
            conversation.name || "Untitled",
          )
        }
      >
        Delete
      </button>
    </div>
  ),
}));

vi.mock("../../Search", () => ({
  Search: ({
    placeholder,
    value,
    onChange,
    onSearch,
    onClear,
  }: {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSearch?: (value: string) => void;
    onClear?: () => void;
  }) => (
    <div data-testid="search-input">
      <input
        data-testid="search-field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <button
        data-testid="search-button"
        onClick={() => onSearch?.(value || "")}
      >
        Search
      </button>
      <button data-testid="clear-button" onClick={() => onClear?.()}>
        Clear
      </button>
    </div>
  ),
}));

vi.mock("../../NoData", () => ({
  NoData: ({
    icon: Icon,
    title,
    description,
  }: {
    icon: unknown;
    title: string;
    description?: string;
  }) => (
    <div data-testid="no-data">
      <div data-testid="no-data-title">{title}</div>
      {description && (
        <div data-testid="no-data-description">{description}</div>
      )}
    </div>
  ),
}));

describe("ChatHistoryList", () => {
  const defaultSession = { user: { id: "user-1" } };
  const defaultConversations = [
    {
      id: "conv-1",
      name: "First Conversation",
      eTag: "etag-1",
      createdAt: "2024-01-01T00:00:00Z",
      messages: [{ createdAt: "2024-01-01T00:00:00Z" }],
    },
    {
      id: "conv-2",
      name: "Second Conversation",
      eTag: "etag-2",
      createdAt: "2024-01-02T00:00:00Z",
      messages: [{ createdAt: "2024-01-02T00:00:00Z" }],
    },
    {
      id: "conv-3",
      name: "Third Conversation",
      eTag: "etag-3",
      createdAt: "2024-01-03T00:00:00Z",
      messages: [{ createdAt: "2024-01-03T00:00:00Z" }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading skeleton when isLoading is true", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi
        .fn()
        .mockImplementation(() => new Promise(() => {})),
    });

    render(<ChatHistoryList session={defaultSession} />);

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("should render error message when fetch fails", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockRejectedValue(new Error("API Error")),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load chat history"),
      ).toBeInTheDocument();
    });
  });

  it("should not fetch conversations when hasToken is false", async () => {
    const mockQueryConversations = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: false,
      queryConversations: mockQueryConversations,
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(mockQueryConversations).not.toHaveBeenCalled();
    });
  });

  it("should fetch and render conversations successfully", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
      expect(screen.getByTestId("chat-item-conv-2")).toBeInTheDocument();
      expect(screen.getByTestId("chat-item-conv-3")).toBeInTheDocument();
    });

    expect(screen.getByText("First Conversation")).toBeInTheDocument();
    expect(screen.getByText("Second Conversation")).toBeInTheDocument();
    expect(screen.getByText("Third Conversation")).toBeInTheDocument();
  });

  it("should filter out conversations without messages", async () => {
    const conversationsWithEmpty = [
      ...defaultConversations,
      {
        id: "conv-empty",
        name: "Empty Conversation",
        eTag: "etag-empty",
        messages: [],
      },
      {
        id: "conv-no-messages",
        name: "No Messages",
        eTag: "etag-no-messages",
      },
    ];

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: conversationsWithEmpty,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId("chat-item-conv-empty"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("chat-item-conv-no-messages"),
    ).not.toBeInTheDocument();
  });

  it("should render empty state when no conversations", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: [],
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("no-data")).toBeInTheDocument();
      expect(screen.getByTestId("no-data-title")).toHaveTextContent(
        "Your Chat history will appear here",
      );
      expect(screen.getByTestId("no-data-description")).toHaveTextContent(
        "Ask a question first",
      );
    });
  });

  const searchFor = async (text: string) => {
    await userEvent.type(screen.getByTestId("search-field"), text);
    await userEvent.click(screen.getByTestId("search-button"));
  };

  it("searches conversation names on the server", async () => {
    const queryConversations = vi
      .fn()
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
      .mockResolvedValueOnce({ items: [defaultConversations[0]], count: 1 });
    mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-2");
    await searchFor("First");

    await waitFor(() => {
      expect(screen.queryByTestId("chat-item-conv-2")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    const payload = queryConversations.mock.calls[1][0];
    expect(payload.like).toBe("%First%");
    expect(payload.page).toEqual({ Offset: 0, Size: 10 });
  });

  it("should show no results message when search has no matches", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi
        .fn()
        .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
        .mockResolvedValueOnce({ items: [], count: 0 }),
    });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-1");
    await searchFor("Nonexistent");

    expect(await screen.findByTestId("no-data-title")).toHaveTextContent(
      "No results found",
    );
    expect(screen.getByTestId("no-data-description")).toHaveTextContent(
      "Please try different search",
    );
  });

  it("shows the newest conversations again when the search is cleared", async () => {
    const queryConversations = vi
      .fn()
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
      .mockResolvedValueOnce({ items: [defaultConversations[0]], count: 1 })
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 });
    mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-2");
    await searchFor("First");
    await waitFor(() => {
      expect(screen.queryByTestId("chat-item-conv-2")).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("clear-button"));

    await screen.findByTestId("chat-item-conv-2");
    expect(queryConversations.mock.calls[2][0].like).toBeUndefined();
    expect(queryConversations.mock.calls[2][0].page).toEqual({
      Offset: 0,
      Size: 10,
    });
  });

  it("should mark active conversation correctly", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(
      <ChatHistoryList
        session={defaultSession}
        currentConversationId="conv-2"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-2")).toBeInTheDocument();
    });

    const activeIndicator = screen.getByTestId("active-indicator");
    expect(activeIndicator).toBeInTheDocument();
    expect(
      activeIndicator.closest('[data-testid="chat-item-conv-2"]'),
    ).toBeTruthy();
  });

  it("should call onConversationUpdate when conversation is updated", async () => {
    const mockOnConversationUpdate = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(
      <ChatHistoryList
        session={defaultSession}
        onConversationUpdate={mockOnConversationUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    const updateButton = screen.getByTestId("update-conv-1");
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(mockOnConversationUpdate).toHaveBeenCalledWith(
        "conv-1",
        "New Name",
        "new-etag",
      );
    });
  });

  it("should call onDeleteConversation when conversation is deleted", async () => {
    const mockOnDeleteConversation = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(
      <ChatHistoryList
        session={defaultSession}
        onDeleteConversation={mockOnDeleteConversation}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId("delete-conv-1");
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockOnDeleteConversation).toHaveBeenCalledWith(
        "conv-1",
        "First Conversation",
      );
    });
  });

  it("should use external conversations when provided", async () => {
    const externalConversations = [
      {
        id: "external-1",
        name: "External Conversation",
        eTag: "etag-external-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const setExternalConversations = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(
      <ChatHistoryList
        session={defaultSession}
        conversations={externalConversations}
        setConversations={setExternalConversations}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-external-1")).toBeInTheDocument();
      expect(screen.getByText("External Conversation")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("chat-item-conv-1")).not.toBeInTheDocument();
  });

  it("should handle conversations with no name (Untitled)", async () => {
    const conversationsWithoutName = [
      {
        id: "conv-untitled",
        eTag: "etag-untitled",
        createdAt: "2024-01-01T00:00:00Z",
        messages: [{ createdAt: "2024-01-01T00:00:00Z" }],
      },
    ];

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: conversationsWithoutName,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-untitled")).toBeInTheDocument();
      expect(screen.getByText("Untitled Conversation")).toBeInTheDocument();
    });
  });

  it("shows the newest conversations again when the search text is deleted by hand", async () => {
    const queryConversations = vi
      .fn()
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
      .mockResolvedValueOnce({ items: [defaultConversations[0]], count: 1 })
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 });
    mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-2");
    await searchFor("First");
    await waitFor(() => {
      expect(screen.queryByTestId("chat-item-conv-2")).not.toBeInTheDocument();
    });

    await userEvent.clear(screen.getByTestId("search-field"));

    await screen.findByTestId("chat-item-conv-2");
    expect(queryConversations).toHaveBeenCalledTimes(3);
    expect(queryConversations.mock.calls[2][0].like).toBeUndefined();
  });

  it("matches wildcard characters in the search literally", async () => {
    const queryConversations = vi
      .fn()
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
      .mockResolvedValueOnce({ items: [], count: 0 });
    mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-1");
    await searchFor("50%_a\\b");

    await waitFor(() => expect(queryConversations).toHaveBeenCalledTimes(2));
    expect(queryConversations.mock.calls[1][0].like).toBe("%50\\%\\_a\\\\b%");
  });

  it("keeps the search box and explains when a search fails", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi
        .fn()
        .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
        .mockRejectedValueOnce(new Error("boom")),
    });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-1");
    await searchFor("First");

    expect(await screen.findByTestId("no-data-title")).toHaveTextContent(
      "Couldn't search chats",
    );
    expect(screen.getByTestId("search-field")).toBeInTheDocument();
  });

  it("keeps the search when loading more results", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i + 1}`,
      name: `Temperature ${i + 1}`,
      eTag: "e",
      createdAt: "2024-01-01T00:00:00Z",
      messages: [{ id: "m" }],
    }));
    const queryConversations = vi
      .fn()
      .mockResolvedValueOnce({ items: defaultConversations, count: 3 })
      .mockResolvedValueOnce({ items: many, count: 12 })
      .mockResolvedValueOnce({ items: [{ ...many[0], id: "s11" }], count: 12 });
    mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

    render(<ChatHistoryList session={defaultSession} />);
    await screen.findByTestId("chat-item-conv-1");
    await searchFor("temp");
    await screen.findByTestId("chat-item-s10");

    await userEvent.click(
      screen.getByRole("button", { name: "Load more chats" }),
    );
    await screen.findByTestId("chat-item-s11");
    expect(queryConversations.mock.calls[2][0].like).toBe("%temp%");
    expect(queryConversations.mock.calls[2][0].page).toEqual({
      Offset: 10,
      Size: 10,
    });
  });

  describe("light, paged request", () => {
    it("asks for the first ten conversations without message content", async () => {
      const queryConversations = vi
        .fn()
        .mockResolvedValue({ items: defaultConversations, count: 3 });
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);

      await waitFor(() => {
        expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
      });
      expect(queryConversations).toHaveBeenCalledTimes(1);
      const payload = queryConversations.mock.calls[0][0];
      expect(payload.page).toEqual({ Offset: 0, Size: 10 });
      expect(payload.Order).toEqual({ Items: ["-createdAt"] });
      expect(payload.Metadata).toEqual({ CountAll: true });
      expect(payload.project.fields).toEqual(
        expect.arrayContaining([
          "id",
          "name",
          "eTag",
          "createdAt",
          "messages.id",
        ]),
      );
      expect(payload.project.fields).not.toContain("messages.data");
      expect(payload.project.fields).not.toContain("messages.kind");
      expect(payload.like).toBeUndefined();
    });

    it("shows the conversation's own creation date", async () => {
      mockUseApi.mockReturnValue({
        hasToken: true,
        queryConversations: vi.fn().mockResolvedValue({
          items: [
            {
              id: "conv-1",
              name: "First Conversation",
              eTag: "etag-1",
              createdAt: "2024-01-01T00:00:00Z",
              messages: [{ id: "m2" }, { id: "m1" }],
            },
          ],
          count: 1,
        }),
      });

      render(<ChatHistoryList session={defaultSession} />);

      expect(await screen.findByTestId("chat-item-conv-1")).toHaveAttribute(
        "data-created",
        "2024-01-01T00:00:00Z",
      );
    });
  });

  describe("load more", () => {
    const conv = (n: number) => ({
      id: `c${n}`,
      name: `Chat ${n}`,
      eTag: `e${n}`,
      createdAt: "2024-01-01T00:00:00Z",
      messages: [{ id: `m${n}` }],
    });
    const page = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => conv(from + i));

    it("offers more while the server has more and appends the next page", async () => {
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({ items: page(1, 10), count: 25 })
        .mockResolvedValueOnce({ items: page(11, 20), count: 25 })
        .mockResolvedValueOnce({ items: page(21, 25), count: 25 });
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);
      await screen.findByTestId("chat-item-c10");

      await userEvent.click(
        screen.getByRole("button", { name: "Load more chats" }),
      );
      await screen.findByTestId("chat-item-c20");
      expect(screen.getByTestId("chat-item-c1")).toBeInTheDocument();
      expect(queryConversations.mock.calls[1][0].page).toEqual({
        Offset: 10,
        Size: 10,
      });

      await userEvent.click(
        screen.getByRole("button", { name: "Load more chats" }),
      );
      await screen.findByTestId("chat-item-c25");
      expect(queryConversations.mock.calls[2][0].page).toEqual({
        Offset: 20,
        Size: 10,
      });
      expect(
        screen.queryByRole("button", { name: "Load more chats" }),
      ).toBeNull();
    });

    it("does not offer more when everything is loaded", async () => {
      mockUseApi.mockReturnValue({
        hasToken: true,
        queryConversations: vi
          .fn()
          .mockResolvedValue({ items: page(1, 3), count: 3 }),
      });

      render(<ChatHistoryList session={defaultSession} />);
      await screen.findByTestId("chat-item-c3");
      expect(
        screen.queryByRole("button", { name: "Load more chats" }),
      ).toBeNull();
    });

    it("counts hidden empty conversations when paging", async () => {
      const first = [...page(1, 9), { ...conv(10), messages: [] }];
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({ items: first, count: 12 })
        .mockResolvedValueOnce({ items: page(11, 12), count: 12 });
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);
      await screen.findByTestId("chat-item-c9");
      expect(screen.queryByTestId("chat-item-c10")).toBeNull();

      await userEvent.click(
        screen.getByRole("button", { name: "Load more chats" }),
      );
      await screen.findByTestId("chat-item-c12");
      expect(queryConversations.mock.calls[1][0].page).toEqual({
        Offset: 10,
        Size: 10,
      });
    });

    it("keeps the list and offers a retry when loading more fails", async () => {
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({ items: page(1, 10), count: 15 })
        .mockRejectedValueOnce(new Error("boom"));
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);
      await screen.findByTestId("chat-item-c10");
      await userEvent.click(
        screen.getByRole("button", { name: "Load more chats" }),
      );

      expect(
        await screen.findByText("Couldn't load more chats."),
      ).toBeInTheDocument();
      expect(screen.getByTestId("chat-item-c1")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Load more chats" }),
      ).toBeEnabled();
    });
  });

  describe("paging edge cases", () => {
    const conv = (n: number, messages: unknown[] = [{ id: `m${n}` }]) => ({
      id: `c${n}`,
      name: `Chat ${n}`,
      eTag: `e${n}`,
      createdAt: "2024-01-01T00:00:00Z",
      messages,
    });
    const page = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => conv(from + i));
    const loadMore = () =>
      screen.queryByRole("button", { name: "Load more chats" });

    it("hides Load more while a new search is loading", async () => {
      let resolveSearch: (v: unknown) => void = () => {};
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({ items: page(1, 10), count: 25 })
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolveSearch = r;
            }),
        );
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);
      await screen.findByTestId("chat-item-c10");
      expect(loadMore()).toBeInTheDocument();

      await userEvent.type(screen.getByTestId("search-field"), "foo");
      await userEvent.click(screen.getByTestId("search-button"));
      expect(loadMore()).toBeNull();

      await act(async () => resolveSearch({ items: [], count: 0 }));
      expect(await screen.findByTestId("no-data-title")).toHaveTextContent(
        "No results found",
      );
    });

    it("does not skip a chat after one is deleted", async () => {
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({ items: page(1, 10), count: 25 })
        .mockResolvedValueOnce({ items: page(11, 20), count: 24 });
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      let removeC3 = () => {};
      function Parent() {
        const [list, setList] = useState<any[]>([]);
        removeC3 = () => setList((prev) => prev.filter((c) => c.id !== "c3"));
        return (
          <ChatHistoryList
            session={defaultSession}
            conversations={list}
            setConversations={setList}
          />
        );
      }
      render(<Parent />);
      await screen.findByTestId("chat-item-c10");

      act(() => removeC3());
      await userEvent.click(
        screen.getByRole("button", { name: "Load more chats" }),
      );

      await waitFor(() => expect(queryConversations).toHaveBeenCalledTimes(2));
      expect(queryConversations.mock.calls[1][0].page).toEqual({
        Offset: 9,
        Size: 10,
      });
    });

    it("does not show a chat twice when the next page overlaps", async () => {
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({ items: page(1, 10), count: 26 })
        .mockResolvedValueOnce({ items: page(10, 19), count: 26 });
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);
      await screen.findByTestId("chat-item-c10");
      await userEvent.click(
        screen.getByRole("button", { name: "Load more chats" }),
      );
      await screen.findByTestId("chat-item-c19");

      expect(screen.getAllByTestId("chat-item-c10")).toHaveLength(1);
    });

    it("offers Load more when a page holds only empty conversations", async () => {
      const queryConversations = vi
        .fn()
        .mockResolvedValueOnce({
          items: Array.from({ length: 10 }, (_, i) => conv(i + 1, [])),
          count: 12,
        })
        .mockResolvedValueOnce({ items: page(11, 12), count: 12 });
      mockUseApi.mockReturnValue({ hasToken: true, queryConversations });

      render(<ChatHistoryList session={defaultSession} />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Load more chats" }),
      );

      expect(await screen.findByTestId("chat-item-c12")).toBeInTheDocument();
    });
  });
});
