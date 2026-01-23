import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableData } from "@/types/chat";
import { AIMessageContent } from "../AIMessageContent";

vi.mock("@ui/chat/DataTable", () => ({
  DataTable: ({ tableData }: { tableData: TableData }) => (
    <div data-testid="data-table" role="table">
      {JSON.stringify(tableData)}
    </div>
  ),
}));

describe("AIMessageContent", () => {
  const defaultProps = {
    content: "Hello world",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render message content", () => {
    render(<AIMessageContent {...defaultProps} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("should render DataTable when tableData is provided", () => {
    const tableData: TableData = {
      columns: [
        { columnNumber: 1, name: "Col1" },
        { columnNumber: 2, name: "Col2" },
      ],
      rows: [
        {
          rowNumber: 1,
          cells: [
            { column: "Col1", value: "A" },
            { column: "Col2", value: "B" },
          ],
        },
        {
          rowNumber: 2,
          cells: [
            { column: "Col1", value: "C" },
            { column: "Col2", value: "D" },
          ],
        },
      ],
    };

    render(<AIMessageContent content="With table" tableData={tableData} />);

    const table = screen.getByTestId("data-table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute("role", "table");
    expect(table.textContent).toContain("Col1");
    expect(table.textContent).toContain("Col2");
  });

  it("should not render DataTable when tableData is not provided", () => {
    render(<AIMessageContent {...defaultProps} />);

    expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("should render both content and table when both are provided", () => {
    const tableData: TableData = {
      columns: [{ columnNumber: 1, name: "Col1" }],
      rows: [
        {
          rowNumber: 1,
          cells: [{ column: "Col1", value: "A" }],
        },
      ],
    };

    render(<AIMessageContent content="Test content" tableData={tableData} />);

    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(screen.getByTestId("data-table")).toBeInTheDocument();
  });
});
