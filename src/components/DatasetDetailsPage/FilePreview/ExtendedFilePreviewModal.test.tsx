import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import ExtendedFilePreviewModal from "./ExtendedFilePreviewModal";

const data = {
  type: "tabular" as const,
  filename: "data.csv",
  fileSize: "",
  description: "",
  columns: [],
  rows: [],
  statistics: [],
  totalRows: 0,
  dataQuality: [],
};
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open preview</button>
      <ExtendedFilePreviewModal
        isOpen={open}
        fileData={data}
        activeTab="preview"
        columns={[]}
        onClose={() => setOpen(false)}
        onSaveColumns={vi.fn()}
        onTabChange={vi.fn()}
      />
    </>
  );
}
it("keeps nested Show columns Escape from closing Extended view", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Open preview" });
  trigger.focus();
  fireEvent.click(trigger);
  const parent = screen.getByRole("dialog", { name: "Extended view" });
  const columns = within(parent).getByRole("button", { name: /columns/ });
  columns.focus();
  fireEvent.click(columns);
  expect(screen.getAllByRole("dialog")).toHaveLength(2);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(columns).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger).toHaveFocus();
});
