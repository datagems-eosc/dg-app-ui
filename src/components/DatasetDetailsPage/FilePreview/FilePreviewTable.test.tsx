import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import FilePreviewTable from "./FilePreviewTable";

it("sorts through a keyboard button and announces its direction", () => {
  render(
    <FilePreviewTable
      columns={[{ id: "a", name: "Score", type: "number", visible: true }]}
      rows={[
        { id: "1", cells: [{ columnId: "a", value: 2 }] },
        { id: "2", cells: [{ columnId: "a", value: 1 }] },
      ]}
      totalRows={9546}
      statistics={[]}
      onShowColumnsClick={vi.fn()}
    />,
  );
  const sort = screen.getByRole("button", { name: "Score" });
  fireEvent.click(sort);
  expect(sort.closest("th")).toHaveAttribute("aria-sort", "ascending");
  expect(
    within(screen.getAllByRole("row")[2]).getByText("1"),
  ).toBeInTheDocument();
  fireEvent.click(sort);
  expect(sort.closest("th")).toHaveAttribute("aria-sort", "descending");
  fireEvent.click(sort);
  expect(sort.closest("th")).not.toHaveAttribute("aria-sort");
  expect(screen.getByText("2 example rows of 9,546")).toBeInTheDocument();
});
it.each([undefined, 0])(
  "does not turn an unknown total into a sample count, preserves zero %j",
  (totalRows) => {
    render(
      <FilePreviewTable
        columns={[]}
        rows={[]}
        totalRows={totalRows}
        statistics={[]}
        onShowColumnsClick={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        totalRows === 0
          ? "0 example rows of 0"
          : "0 example rows. Total rows not available.",
      ),
    ).toBeInTheDocument();
  },
);
it("preserves zero unique values and does not invent histogram units", () => {
  const { container } = render(
    <FilePreviewTable
      columns={[
        { id: "a", name: "Category", type: "categorical", visible: true },
        { id: "b", name: "Score", type: "number", visible: true },
      ]}
      rows={[]}
      totalRows={10}
      statistics={[
        { columnId: "a", uniqueValues: 0 },
        { columnId: "b", min: 1, max: 2, distribution: [1, 2] },
      ]}
      onShowColumnsClick={() => {}}
    />,
  );
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(container.textContent).not.toContain("°C");
});
