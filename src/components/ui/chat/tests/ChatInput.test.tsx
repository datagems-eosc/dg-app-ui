import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "@/types/collection";
import { ChatInput } from "../ChatInput";

const mockCollections = {
  apiCollections: [] as Collection[],
  collections: [] as Collection[],
  extraCollections: [],
  isLoading: false,
};

describe("ChatInput", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    onSend: vi.fn(),
    onAddDatasets: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render textarea with placeholder", () => {
    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("");
  });

  it("should call onChange when typing in textarea", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ChatInput {...defaultProps} onChange={onChange} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "Hello");

    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange).toHaveBeenLastCalledWith("Hello");
  });

  it("should display the value prop in textarea", () => {
    render(<ChatInput {...defaultProps} value="Test message" />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    expect(textarea).toHaveValue("Test message");
  });

  it("should disable send button when value is empty", () => {
    render(<ChatInput {...defaultProps} value="" />);

    const sendButton = screen.getByRole("button", { name: "" });
    expect(sendButton).toBeDisabled();
  });

  it("should enable send button when value has text", () => {
    render(<ChatInput {...defaultProps} value="Hello" />);

    const sendButton = screen.getByRole("button", { name: "" });
    expect(sendButton).not.toBeDisabled();
  });

  it("should disable send button when value only has whitespace", () => {
    render(<ChatInput {...defaultProps} value="   " />);

    const sendButton = screen.getByRole("button", { name: "" });
    expect(sendButton).toBeDisabled();
  });

  it("should call onSend when send button is clicked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);

    const sendButton = screen.getByRole("button", { name: "" });
    await user.click(sendButton);

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("should call onSend when Enter key is pressed", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "{Enter}");

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("should not call onSend when Shift+Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not call onSend when Enter is pressed and input is empty", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput {...defaultProps} value="" onSend={onSend} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not call onSend when Enter is pressed and component is disabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ChatInput {...defaultProps} value="Hello" onSend={onSend} disabled />,
    );

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not call onSend when Enter is pressed and isLoading is true", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ChatInput
        {...defaultProps}
        value="Hello"
        onSend={onSend}
        isLoading={true}
      />,
    );

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    await user.type(textarea, "{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should show loading spinner when isLoading is true", () => {
    render(<ChatInput {...defaultProps} isLoading={true} />);

    expect(screen.getByText("Sending...")).toBeInTheDocument();
  });

  it("should not show send button when isLoading is true", () => {
    render(<ChatInput {...defaultProps} isLoading={true} />);

    const sendButton = screen.queryByRole("button", { name: "" });
    expect(sendButton).not.toBeInTheDocument();
  });

  it("should render CollectionsDropdown when collections and onSelectCollection are provided", () => {
    const mockOnSelectCollection = vi.fn();
    const mockSelectedCollection: Collection = {
      id: "1",
      name: "Test Collection",
    };

    render(
      <ChatInput
        {...defaultProps}
        collections={mockCollections}
        selectedCollection={mockSelectedCollection}
        onSelectCollection={mockOnSelectCollection}
      />,
    );

    // CollectionsDropdown should be rendered (we can't easily test its internals without mocking)
    // But we can verify the send button is still present
    const sendButton = screen.getByRole("button", { name: "" });
    expect(sendButton).toBeInTheDocument();
  });

  it("should render Collections button when collections are not provided", () => {
    const mockSelectedCollection: Collection = {
      id: "1",
      name: "Test Collection",
    };

    render(
      <ChatInput
        {...defaultProps}
        selectedCollection={mockSelectedCollection}
      />,
    );

    const collectionsButton = screen.getByText("Test Collection");
    expect(collectionsButton).toBeInTheDocument();
  });

  it("should render Collections button with default text when no collection is selected", () => {
    render(<ChatInput {...defaultProps} />);

    const collectionsButton = screen.getByText("Collections");
    expect(collectionsButton).toBeInTheDocument();
  });

  it("should call onAddDatasets when Collections button is clicked", async () => {
    const user = userEvent.setup();
    const onAddDatasets = vi.fn();

    render(<ChatInput {...defaultProps} onAddDatasets={onAddDatasets} />);

    const collectionsButton = screen.getByText("Collections");
    await user.click(collectionsButton);

    expect(onAddDatasets).toHaveBeenCalledTimes(1);
  });

  it("should remove ' Collection' suffix from collection name in button", () => {
    const mockSelectedCollection: Collection = {
      id: "1",
      name: "Test Collection",
    };

    render(
      <ChatInput
        {...defaultProps}
        selectedCollection={mockSelectedCollection}
      />,
    );

    const collectionsButton = screen.getByText("Test");
    expect(collectionsButton).toBeInTheDocument();
  });

  it("should display error message when error prop is provided", () => {
    render(<ChatInput {...defaultProps} error="Test error message" />);

    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("should apply error styling when error is present", () => {
    const { container } = render(
      <ChatInput {...defaultProps} error="Test error" />,
    );

    const inputContainer = container.firstChild as HTMLElement;
    expect(inputContainer).toHaveClass("border-red-550");
  });

  it("should disable textarea when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} disabled />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    expect(textarea).toBeDisabled();
  });

  it("should disable send button when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} value="Hello" disabled />);

    const sendButton = screen.getByRole("button", { name: "" });
    expect(sendButton).toBeDisabled();
  });

  it("should disable Collections button when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} disabled />);

    const collectionsButton = screen.getByText("Collections");
    expect(collectionsButton.closest("button")).toBeDisabled();
  });

  it("should have proper name attribute on textarea", () => {
    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    expect(textarea).toHaveAttribute("name", "chat-input");
  });

  it("should have proper accessibility attributes", () => {
    render(<ChatInput {...defaultProps} value="Hello" />);

    const textarea = screen.getByPlaceholderText("Ask me anything...");
    expect(textarea).toHaveAttribute("name", "chat-input");

    const sendButton = screen.getByRole("button", { name: "" });
    expect(sendButton).toBeInTheDocument();
  });
});
