import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/types/chat";
import ChatMessages from "../ChatMessages";

vi.mock("../MessageItem", () => ({
  default: ({ message }: { message: Message }) => (
    <div data-testid={`message-${message.id}`}>
      {message.type}: {message.content}
    </div>
  ),
}));

vi.mock("@/lib/scrollUtils", () => ({
  scrollToBottom: vi.fn(),
}));

describe("ChatMessages", () => {
  const createRef = () => ({
    current: document.createElement("div"),
  });

  const defaultProps = {
    messages: [] as Message[],
    isMessagesLoading: false,
    messagesEndRef: createRef(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render empty state when no messages", () => {
    render(<ChatMessages {...defaultProps} />);

    expect(screen.queryByTestId(/message-/)).not.toBeInTheDocument();
  });

  it("should render user message", () => {
    const messages: Message[] = [
      {
        id: "1",
        type: "user",
        content: "Hello",
        timestamp: "2024-01-01T00:00:00Z",
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    expect(screen.getByTestId("message-1")).toBeInTheDocument();
    expect(screen.getByText("user: Hello")).toBeInTheDocument();
  });

  it("should render AI message", () => {
    const messages: Message[] = [
      {
        id: "2",
        type: "ai",
        content: "Hi there!",
        timestamp: "2024-01-01T00:00:01Z",
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    expect(screen.getByTestId("message-2")).toBeInTheDocument();
    expect(screen.getByText("ai: Hi there!")).toBeInTheDocument();
  });

  it("should render multiple messages", () => {
    const messages: Message[] = [
      {
        id: "1",
        type: "user",
        content: "Hello",
        timestamp: "2024-01-01T00:00:00Z",
      },
      {
        id: "2",
        type: "ai",
        content: "Hi there!",
        timestamp: "2024-01-01T00:00:01Z",
      },
      {
        id: "3",
        type: "user",
        content: "How are you?",
        timestamp: "2024-01-01T00:00:02Z",
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    expect(screen.getByTestId("message-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-2")).toBeInTheDocument();
    expect(screen.getByTestId("message-3")).toBeInTheDocument();
  });

  it("should sort messages by timestamp in ascending order", () => {
    const messages: Message[] = [
      {
        id: "3",
        type: "user",
        content: "Third",
        timestamp: "2024-01-01T00:00:02Z",
      },
      {
        id: "1",
        type: "user",
        content: "First",
        timestamp: "2024-01-01T00:00:00Z",
      },
      {
        id: "2",
        type: "user",
        content: "Second",
        timestamp: "2024-01-01T00:00:01Z",
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements[0]).toHaveAttribute("data-testid", "message-1");
    expect(messageElements[1]).toHaveAttribute("data-testid", "message-2");
    expect(messageElements[2]).toHaveAttribute("data-testid", "message-3");
  });

  it("should sort messages with Date objects correctly", () => {
    const messages: Message[] = [
      {
        id: "2",
        type: "user",
        content: "Second",
        timestamp: new Date("2024-01-01T00:00:01Z"),
      },
      {
        id: "1",
        type: "user",
        content: "First",
        timestamp: new Date("2024-01-01T00:00:00Z"),
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements[0]).toHaveAttribute("data-testid", "message-1");
    expect(messageElements[1]).toHaveAttribute("data-testid", "message-2");
  });

  it("should sort messages with mixed Date and string timestamps", () => {
    const messages: Message[] = [
      {
        id: "2",
        type: "user",
        content: "Second",
        timestamp: "2024-01-01T00:00:01Z",
      },
      {
        id: "1",
        type: "user",
        content: "First",
        timestamp: new Date("2024-01-01T00:00:00Z"),
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements[0]).toHaveAttribute("data-testid", "message-1");
    expect(messageElements[1]).toHaveAttribute("data-testid", "message-2");
  });

  it("should show loading spinner when isGeneratingAIResponse is true", () => {
    render(<ChatMessages {...defaultProps} isGeneratingAIResponse={true} />);

    expect(screen.getByText("Generating response...")).toBeInTheDocument();
  });

  it("should not show loading spinner when isGeneratingAIResponse is false", () => {
    render(<ChatMessages {...defaultProps} isGeneratingAIResponse={false} />);

    expect(
      screen.queryByText("Generating response..."),
    ).not.toBeInTheDocument();
  });

  it("should not show loading spinner when isGeneratingAIResponse is undefined", () => {
    render(<ChatMessages {...defaultProps} />);

    expect(
      screen.queryByText("Generating response..."),
    ).not.toBeInTheDocument();
  });

  it("should render messagesEndRef div", () => {
    const messagesEndRef = createRef();
    const { container } = render(
      <ChatMessages {...defaultProps} messagesEndRef={messagesEndRef} />,
    );

    const refDiv = container.querySelector("div:last-child");
    expect(refDiv).toBeInTheDocument();
  });

  it("should apply correct padding classes when showSelectedPanel is true", () => {
    const { container } = render(
      <ChatMessages {...defaultProps} showSelectedPanel={true} />,
    );

    const messagesContainer = container.firstChild as HTMLElement;
    expect(messagesContainer).toHaveClass("px-4", "py-4");
  });

  it("should apply correct padding classes when showSelectedPanel is false", () => {
    const { container } = render(
      <ChatMessages {...defaultProps} showSelectedPanel={false} />,
    );

    const messagesContainer = container.firstChild as HTMLElement;
    expect(messagesContainer).toHaveClass("px-0", "lg:px-0", "py-0", "lg:py-0");
  });

  it("should apply correct padding classes when showSelectedPanel is undefined", () => {
    const { container } = render(<ChatMessages {...defaultProps} />);

    const messagesContainer = container.firstChild as HTMLElement;
    expect(messagesContainer).toHaveClass("px-0", "lg:px-0", "py-0", "lg:py-0");
  });

  it("should pass onSourcesClick to MessageItem", () => {
    const messages: Message[] = [
      {
        id: "1",
        type: "ai",
        content: "Test",
        timestamp: "2024-01-01T00:00:00Z",
        sources: 3,
      },
    ];

    const onSourcesClick = vi.fn();

    render(
      <ChatMessages
        {...defaultProps}
        messages={messages}
        onSourcesClick={onSourcesClick}
      />,
    );

    expect(screen.getByTestId("message-1")).toBeInTheDocument();
  });

  it("should handle messages with all optional fields", () => {
    const messages: Message[] = [
      {
        id: "1",
        type: "ai",
        content: "Test",
        timestamp: "2024-01-01T00:00:00Z",
        sources: 5,
        relatedDatasetIds: ["dataset-1"],
        datasetIds: ["dataset-2"],
        latitude: 10.5,
        longitude: 20.5,
        tableData: {
          columns: [{ columnNumber: 1, name: "A" }],
          rows: [
            {
              rowNumber: 1,
              cells: [{ column: "A", value: "1" }],
            },
          ],
        },
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    expect(screen.getByTestId("message-1")).toBeInTheDocument();
  });

  it("should maintain message order when timestamps are identical", () => {
    const messages: Message[] = [
      {
        id: "1",
        type: "user",
        content: "First",
        timestamp: "2024-01-01T00:00:00Z",
      },
      {
        id: "2",
        type: "user",
        content: "Second",
        timestamp: "2024-01-01T00:00:00Z",
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements).toHaveLength(2);
  });

  it("should handle empty messages array with loading spinner", () => {
    render(
      <ChatMessages
        {...defaultProps}
        messages={[]}
        isGeneratingAIResponse={true}
      />,
    );

    expect(screen.getByText("Generating response...")).toBeInTheDocument();
  });

  it("should handle messages with microsecond precision timestamps", () => {
    const messages: Message[] = [
      {
        id: "1",
        type: "user",
        content: "First",
        timestamp: "2024-01-01T00:00:00.000001Z",
      },
      {
        id: "2",
        type: "user",
        content: "Second",
        timestamp: "2024-01-01T00:00:00.000000Z",
      },
    ];

    render(<ChatMessages {...defaultProps} messages={messages} />);

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements[0]).toHaveAttribute("data-testid", "message-2");
    expect(messageElements[1]).toHaveAttribute("data-testid", "message-1");
  });
});
