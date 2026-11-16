import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import type { FileColumn } from "@/types/filePreview";
import ShowColumnsModal from "./ShowColumnsModal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open columns</button>
      <ShowColumnsModal
        isOpen={open}
        columns={[{ id: "a", name: "A", type: "number", visible: true }]}
        onClose={() => setOpen(false)}
        onSave={() => {}}
      />
    </>
  );
}
it("names the dialog, contains focus and restores the trigger after Escape", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Open columns" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Show columns" });
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it("opens with current columns after they arrive and cancels without saving", () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const columns: FileColumn[] = [
    { id: "a", name: "A", type: "number", visible: true },
  ];
  const { rerender } = render(
    <ShowColumnsModal
      isOpen={false}
      columns={[]}
      onClose={onClose}
      onSave={onSave}
    />,
  );
  const show = (isOpen: boolean) => (
    <ShowColumnsModal
      isOpen={isOpen}
      columns={columns}
      onClose={onClose}
      onSave={onSave}
    />
  );
  rerender(show(true));
  const checkbox = screen.getByRole("checkbox", { name: "A" });
  expect(checkbox).toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
  rerender(show(false));
  rerender(show(true));
  expect(screen.getByRole("checkbox", { name: "A" })).toBeChecked();
  expect(onSave).not.toHaveBeenCalled();
});
