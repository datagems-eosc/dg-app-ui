import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/types/chat";
import MessageItem from "../MessageItem";

vi.mock("../AIMessage", () => ({
  AIMessage: ({
    message,
    onSourcesClick,
  }: {
    message: Message;
    onSourcesClick?: () => void;
  }) => (
    <div
      data-testid="ai-message"
      data-message-id={message.id}
      onClick={onSourcesClick}
    >
      AI Message: {message.content}
    </div>
  ),
}));

vi.mock("../UserMessage", () => ({
  UserMessage: ({ content }: { content: string }) => (
    <div data-testid="user-message">User Message: {content}</div>
  ),
}));

describe("MessageItem", () => {
  const defaultUserMessage: Message = {
    id: "user-1",
    type: "user",
    content: "Hello, how are you?",
    timestamp: new Date().toISOString(),
  };

  const defaultAIMessage: Message = {
    id: "ai-1",
    type: "ai",
    content: "I'm doing well, thank you!",
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render UserMessage for user type messages", () => {
    render(<MessageItem message={defaultUserMessage} />);

    expect(screen.getByTestId("user-message")).toBeInTheDocument();
    expect(
      screen.getByText("User Message: Hello, how are you?"),
    ).toBeInTheDocument();
  });

  it("should render AIMessage for ai type messages", () => {
    render(<MessageItem message={defaultAIMessage} />);

    expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    expect(screen.getByText("I'm doing well, thank you!")).toBeInTheDocument();
  });

  it("should pass message content to UserMessage", () => {
    const message: Message = {
      ...defaultUserMessage,
      content: "Custom user message",
    };

    render(<MessageItem message={message} />);

    expect(
      screen.getByText("User Message: Custom user message"),
    ).toBeInTheDocument();
  });

  it("should pass message to AIMessage with correct id", () => {
    const message: Message = {
      ...defaultAIMessage,
      id: "ai-custom-123",
      content: "Custom AI response",
    };

    render(<MessageItem message={message} />);

    const aiMessage = screen.getByTestId("ai-message");
    expect(aiMessage).toHaveAttribute("data-message-id", "ai-custom-123");
    expect(aiMessage).toHaveTextContent("Custom AI response");
  });

  it("should call onSourcesClick with message id when provided for AI messages", async () => {
    const user = userEvent.setup();
    const onSourcesClick = vi.fn();
    const message: Message = {
      ...defaultAIMessage,
      id: "ai-123",
    };

    render(<MessageItem message={message} onSourcesClick={onSourcesClick} />);

    const aiMessage = screen.getByTestId("ai-message");
    await user.click(aiMessage);

    expect(onSourcesClick).toHaveBeenCalledTimes(1);
    expect(onSourcesClick).toHaveBeenCalledWith("ai-123");
  });

  it("should not call onSourcesClick when not provided", async () => {
    const user = userEvent.setup();

    render(<MessageItem message={defaultAIMessage} />);

    const aiMessage = screen.getByTestId("ai-message");
    await user.click(aiMessage);

    expect(aiMessage).toBeInTheDocument();
  });

  it("should render with correct message structure", () => {
    const messageWithAllFields: Message = {
      id: "ai-full",
      type: "ai",
      content: "Full message",
      timestamp: new Date().toISOString(),
      sources: 5,
      latitude: 40.7128,
      longitude: -74.006,
      tableData: {
        columns: [{ columnNumber: 1, name: "A" }],
        rows: [
          {
            rowNumber: 1,
            cells: [{ column: "A", value: "1" }],
          },
        ],
      },
    };

    render(<MessageItem message={messageWithAllFields} />);

    expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    expect(screen.getByText("Full message")).toBeInTheDocument();
  });
});
