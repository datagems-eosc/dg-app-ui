import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationModal } from "./ConfirmationModal";

describe("ConfirmationModal", () => {
  const defaultProps = {
    isVisible: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Test Modal",
    message1: "Primary message",
    message2: "Secondary message",
  };

  it("should not render when isVisible is false", () => {
    const { container } = render(
      <ConfirmationModal {...defaultProps} isVisible={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render with correct content when visible", () => {
    render(<ConfirmationModal {...defaultProps} />);

    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Primary message")).toBeInTheDocument();
    expect(screen.getByText("Secondary message")).toBeInTheDocument();
  });

  it("should have proper ARIA attributes", () => {
    render(<ConfirmationModal {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    expect(dialog).toHaveAttribute("aria-describedby", "modal-description");
  });

  it("should call onClose when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmationModal {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onConfirm when Confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("should disable buttons when isLoading is true", () => {
    render(<ConfirmationModal {...defaultProps} isLoading={true} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    const confirmButton = screen.getByRole("button", { name: /loading/i });

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent("Loading...");
  });

  it("should call onClose when X icon is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmationModal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmationModal {...defaultProps} onClose={onClose} />);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should not call onClose when Escape is pressed while loading", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        {...defaultProps}
        onClose={onClose}
        isLoading={true}
      />,
    );

    await user.keyboard("{Escape}");

    await waitFor(
      () => {
        expect(onClose).not.toHaveBeenCalled();
      },
      { timeout: 100 },
    );
  });

  it("should call onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmationModal {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByRole("dialog");
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should not call onClose when backdrop is clicked while loading", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        {...defaultProps}
        onClose={onClose}
        isLoading={true}
      />,
    );

    const backdrop = screen.getByRole("dialog");
    await user.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("should render with custom button text", () => {
    render(
      <ConfirmationModal
        {...defaultProps}
        confirmText="Delete"
        cancelText="Go Back"
      />,
    );

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go back/i }),
    ).toBeInTheDocument();
  });

  it("should render with danger variant styling", () => {
    render(<ConfirmationModal {...defaultProps} confirmVariant="danger" />);

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toHaveClass("bg-red-550");
  });

  it("should render with custom icon", () => {
    const customIcon = <div data-testid="custom-icon">Custom Icon</div>;

    render(<ConfirmationModal {...defaultProps} icon={customIcon} />);

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("should set body overflow to hidden when modal is open", () => {
    const { unmount } = render(<ConfirmationModal {...defaultProps} />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("unset");
  });

  it("should trap focus within modal", async () => {
    const user = userEvent.setup();

    render(<ConfirmationModal {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    const confirmButton = screen.getByRole("button", { name: /confirm/i });

    closeButton.focus();
    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();

    await user.tab();
    expect(confirmButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it("should restore focus to previous element on unmount", async () => {
    const triggerButton = document.createElement("button");
    triggerButton.setAttribute("data-testid", "trigger");
    document.body.appendChild(triggerButton);
    triggerButton.focus();

    const { unmount } = render(<ConfirmationModal {...defaultProps} />);

    unmount();

    await waitFor(() => {
      expect(triggerButton).toHaveFocus();
    });

    document.body.removeChild(triggerButton);
  });
});
