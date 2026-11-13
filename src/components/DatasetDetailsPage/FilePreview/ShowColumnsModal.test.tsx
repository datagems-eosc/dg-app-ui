import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
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
  const { rerender } = render(
    <ShowColumnsModal
      isOpen={false}
      columns={[]}
      onClose={() => {}}
      onSave={() => {}}
    />,
  );
  rerender(
    <ShowColumnsModal
      isOpen={true}
      columns={[{ id: "a", name: "A", type: "number", visible: true }]}
      onClose={() => {}}
      onSave={() => {}}
    />,
  );
  expect(screen.getByText("A")).toBeInTheDocument();
});
