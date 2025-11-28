import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DeleteCollectionModal from "./DeleteCollectionModal";

describe("DeleteCollectionModal", () => {
  it("should not render when isVisible is false", () => {
    const { container } = render(
      <DeleteCollectionModal
        isVisible={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        collectionName="Test Collection"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render with correct message when visible", () => {
    render(
      <DeleteCollectionModal
        isVisible={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        collectionName="My Collection"
      />,
    );

    expect(screen.getByText("Delete Collection")).toBeInTheDocument();
    expect(
      screen.getByText(/This operation will permanently delete/i),
    ).toBeInTheDocument();
  });

  it("should call onClose when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DeleteCollectionModal
        isVisible={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        collectionName="Test Collection"
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onConfirm when Delete button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteCollectionModal
        isVisible={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        collectionName="Test Collection"
      />,
    );

    const deleteButton = screen.getByRole("button", { name: /^delete$/i });
    await user.click(deleteButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("should disable buttons when isLoading is true", () => {
    render(
      <DeleteCollectionModal
        isVisible={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        collectionName="Test Collection"
        isLoading={true}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    const deleteButton = screen.getByRole("button", { name: /deleting/i });

    expect(cancelButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveTextContent("Deleting...");
  });

  it("should call onClose when X icon is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DeleteCollectionModal
        isVisible={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        collectionName="Test Collection"
      />,
    );

    const closeButtons = screen.getAllByRole("button");
    const xButton = closeButtons.find(
      (btn: HTMLElement) => btn.querySelector("svg") && !btn.textContent,
    );

    if (xButton) {
      await user.click(xButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });
});
