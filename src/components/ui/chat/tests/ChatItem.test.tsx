import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatItem } from "../ChatItem";

const mockUseApi = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/utils", () => ({
  formatRelativeTime: (date: string) => {
    return new Date(date).toLocaleDateString();
  },
}));

describe("ChatItem", () => {
  const defaultConversation = {
    id: "conv-1",
    name: "Test Conversation",
    createdAt: "2024-01-01T00:00:00Z",
    eTag: "etag-123",
  };

  const defaultProps = {
    conversation: defaultConversation,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: vi.fn().mockResolvedValue({ eTag: "new-etag-456" }),
    });
  });

  it("should render conversation name", () => {
    render(<ChatItem {...defaultProps} />);

    expect(screen.getByText("Test Conversation")).toBeInTheDocument();
  });

  it("should render 'Untitled Conversation' when name is not provided", () => {
    render(
      <ChatItem
        {...defaultProps}
        conversation={{ ...defaultConversation, name: undefined }}
      />,
    );

    expect(screen.getByText("Untitled Conversation")).toBeInTheDocument();
  });

  it("should render formatted creation date", () => {
    render(<ChatItem {...defaultProps} />);

    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument();
  });

  it("should render empty date when createdAt is not provided", () => {
    render(
      <ChatItem
        {...defaultProps}
        conversation={{ ...defaultConversation, createdAt: undefined }}
      />,
    );

    const dateElement = screen.getByText("");
    expect(dateElement).toBeInTheDocument();
  });

  it("should render as Link when not active and not editing", () => {
    render(<ChatItem {...defaultProps} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/chat/conv-1");
  });

  it("should render as div when active", () => {
    render(<ChatItem {...defaultProps} isActive />);

    const link = screen.queryByRole("link");
    expect(link).not.toBeInTheDocument();
  });

  it("should apply active styling when isActive is true", () => {
    const { container } = render(<ChatItem {...defaultProps} isActive />);

    const item = container.firstChild as HTMLElement;
    expect(item).toHaveClass("border-blue-300");
  });

  it("should show dropdown menu button on hover", () => {
    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    expect(dropdownButton).toBeInTheDocument();
  });

  it("should open dropdown menu when menu button is clicked", async () => {
    const user = userEvent.setup();

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("should close dropdown when clicking outside", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <ChatItem {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    expect(screen.getByText("Rename")).toBeInTheDocument();

    const outside = screen.getByTestId("outside");
    await user.click(outside);

    await waitFor(() => {
      expect(screen.queryByText("Rename")).not.toBeInTheDocument();
    });
  });

  it("should enter edit mode when Rename is clicked", async () => {
    const user = userEvent.setup();

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    expect(input).toBeInTheDocument();
  });

  it("should focus and select input text when entering edit mode", async () => {
    const user = userEvent.setup();

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue(
      "Test Conversation",
    ) as HTMLInputElement;
    expect(input).toHaveFocus();
  });

  it("should save changes when Enter key is pressed", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi
      .fn()
      .mockResolvedValue({ eTag: "new-etag-456" });
    const onConversationUpdate = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(
      <ChatItem
        {...defaultProps}
        onConversationUpdate={onConversationUpdate}
      />,
    );

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "Updated Name{Enter}");

    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith("conv-1", {
        name: "Updated Name",
        eTag: "etag-123",
      });
    });

    await waitFor(() => {
      expect(onConversationUpdate).toHaveBeenCalledWith(
        "conv-1",
        "Updated Name",
        "new-etag-456",
      );
    });
  });

  it("should cancel edit when Escape key is pressed", async () => {
    const user = userEvent.setup();

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.type(input, "Changed Name{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue("Changed Name"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("Test Conversation")).toBeInTheDocument();
  });

  it("should save changes when input loses focus", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi
      .fn()
      .mockResolvedValue({ eTag: "new-etag-456" });
    const onConversationUpdate = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(
      <ChatItem
        {...defaultProps}
        onConversationUpdate={onConversationUpdate}
      />,
    );

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "Updated Name");
    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith("conv-1", {
        name: "Updated Name",
        eTag: "etag-123",
      });
    });
  });

  it("should not save if name is unchanged", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).not.toHaveBeenCalled();
    });
  });

  it("should not save if name is empty", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).not.toHaveBeenCalled();
    });
  });

  it("should not save if name exceeds 300 characters", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi.fn();
    const longName = "a".repeat(301);

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, longName);
    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).not.toHaveBeenCalled();
    });
  });

  it("should not save if eTag is missing", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(
      <ChatItem
        {...defaultProps}
        conversation={{ ...defaultConversation, eTag: "" }}
      />,
    );

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).not.toHaveBeenCalled();
    });
  });

  it("should not save if hasToken is false", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi.fn();

    mockUseApi.mockReturnValue({
      hasToken: false,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).not.toHaveBeenCalled();
    });
  });

  it("should show success toast when update succeeds", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi
      .fn()
      .mockResolvedValue({ eTag: "new-etag-456" });

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "Updated Name{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("Conversation name updated successfully!"),
      ).toBeInTheDocument();
    });
  });

  it("should show error toast when update fails", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi
      .fn()
      .mockRejectedValue(new Error("Update failed"));

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "Updated Name{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("Failed to update conversation name"),
      ).toBeInTheDocument();
    });
  });

  it("should call onDeleteConversation when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteConversation = vi.fn();

    render(
      <ChatItem
        {...defaultProps}
        onDeleteConversation={onDeleteConversation}
      />,
    );

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const deleteButton = screen.getByText("Delete");
    await user.click(deleteButton);

    expect(onDeleteConversation).toHaveBeenCalledWith(
      "conv-1",
      "Test Conversation",
    );
  });

  it("should close dropdown after delete is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteConversation = vi.fn();

    render(
      <ChatItem
        {...defaultProps}
        onDeleteConversation={onDeleteConversation}
      />,
    );

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const deleteButton = screen.getByText("Delete");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText("Rename")).not.toBeInTheDocument();
    });
  });

  it("should disable input when updating", async () => {
    const user = userEvent.setup();
    const mockUpdateConversation = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ eTag: "new-etag-456" }), 100);
        }),
    );

    mockUseApi.mockReturnValue({
      hasToken: true,
      updateConversation: mockUpdateConversation,
    });

    render(<ChatItem {...defaultProps} />);

    const dropdownButton = screen.getByRole("button", { name: "" });
    await user.click(dropdownButton);

    const renameButton = screen.getByText("Rename");
    await user.click(renameButton);

    const input = screen.getByDisplayValue("Test Conversation");
    await user.clear(input);
    await user.type(input, "Updated Name{Enter}");

    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });

  it("should show tooltip for long conversation names", () => {
    const longName = "a".repeat(31);
    render(
      <ChatItem
        {...defaultProps}
        conversation={{ ...defaultConversation, name: longName }}
      />,
    );

    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  it("should not show tooltip for short conversation names", () => {
    render(<ChatItem {...defaultProps} />);

    const nameElement = screen.getByText("Test Conversation");
    expect(nameElement).toBeInTheDocument();
  });
});
