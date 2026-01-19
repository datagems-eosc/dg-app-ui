import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    conversation: { id: string; name?: string };
    isActive: boolean;
    onConversationUpdate?: (
      id: string,
      newName: string,
      newETag?: string,
    ) => void;
    onDeleteConversation?: (id: string, name: string) => void;
  }) => (
    <div data-testid={`chat-item-${conversation.id}`}>
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

vi.mock("../Search", () => ({
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

vi.mock("../NoData", () => ({
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

  it("should filter conversations by search query", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("search-field");
    await userEvent.type(searchInput, "First");

    const searchButton = screen.getByTestId("search-button");
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
      expect(screen.queryByTestId("chat-item-conv-2")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-item-conv-3")).not.toBeInTheDocument();
    });
  });

  it("should show no results message when search has no matches", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("search-field");
    await userEvent.type(searchInput, "NonExistent");

    const searchButton = screen.getByTestId("search-button");
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId("no-data")).toBeInTheDocument();
      expect(screen.getByTestId("no-data-title")).toHaveTextContent(
        "No results found",
      );
      expect(screen.getByTestId("no-data-description")).toHaveTextContent(
        "Please try different search",
      );
    });
  });

  it("should clear search when clear button is clicked", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("search-field");
    await userEvent.type(searchInput, "First");

    const clearButton = screen.getByTestId("clear-button");
    await userEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
      expect(screen.getByTestId("chat-item-conv-2")).toBeInTheDocument();
      expect(screen.getByTestId("chat-item-conv-3")).toBeInTheDocument();
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

  it("should handle search with case-insensitive matching", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryConversations: vi.fn().mockResolvedValue({
        items: defaultConversations,
      }),
    });

    render(<ChatHistoryList session={defaultSession} />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("search-field");
    await userEvent.type(searchInput, "first");

    const searchButton = screen.getByTestId("search-button");
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId("chat-item-conv-1")).toBeInTheDocument();
      expect(screen.queryByTestId("chat-item-conv-2")).not.toBeInTheDocument();
    });
  });
});
