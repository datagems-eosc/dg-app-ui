import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import type { FilePreviewData } from "@/types/filePreview";
import ExtendedFilePreviewModal from "./ExtendedFilePreviewModal";

const data: FilePreviewData = {
  type: "tabular",
  filename: "data.csv",
  fileSize: "",
  description: "",
  columns: [],
  rows: [],
  statistics: [],
  totalRows: 0,
  dataQuality: { status: "unavailable" },
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
  const child = screen.getByRole("dialog", { name: "Show columns" });
  expect(child).toContainElement(document.activeElement as HTMLElement);
  const save = within(child).getByRole("button", { name: "Save" });
  const close = within(child).getByRole("button", {
    name: "Close",
  });
  save.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(save).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(columns).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger).toHaveFocus();
});

it("includes quality findings in the Extended view tab order", async () => {
  const user = userEvent.setup();
  render(
    <ExtendedFilePreviewModal
      isOpen
      fileData={{
        ...data,
        dataQuality: {
          status: "available",
          summary: "One finding",
          findings: [
            {
              id: "finding",
              column: "Price",
              category: "missing_value",
              description: "Missing price",
            },
          ],
        },
      }}
      activeTab="dataQuality"
      columns={[]}
      onClose={vi.fn()}
      onSaveColumns={vi.fn()}
      onTabChange={vi.fn()}
    />,
  );

  const tab = screen.getByRole("tab", { name: /Data Quality/ });
  tab.focus();
  await user.tab();
  const summary = screen.getByText("Price").closest("summary");
  expect(summary).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  await user.tab({ shift: true });
  expect(summary).toHaveFocus();
});
