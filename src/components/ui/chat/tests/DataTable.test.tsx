import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { TableData } from "@/types/chat";
import { DataTable } from "../DataTable";

vi.mock("../Button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      data-testid="show-more-button"
    >
      {children}
    </button>
  ),
}));

describe("DataTable", () => {
  const createMockTableData = (
    columns: string[],
    rowCount: number,
  ): TableData => {
    return {
      columns: columns.map((name, index) => ({
        columnNumber: index + 1,
        name,
      })),
      rows: Array.from({ length: rowCount }, (_, rowIndex) => ({
        rowNumber: rowIndex + 1,
        cells: columns.map((col) => ({
          column: col,
          value: `value-${rowIndex + 1}-${col}`,
        })),
      })),
    };
  };

  it("should render table with columns and rows", () => {
    const tableData = createMockTableData(["name", "age"], 2);

    render(<DataTable tableData={tableData} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("value-1-name")).toBeInTheDocument();
    expect(screen.getByText("value-1-age")).toBeInTheDocument();
    expect(screen.getByText("value-2-name")).toBeInTheDocument();
    expect(screen.getByText("value-2-age")).toBeInTheDocument();
  });

  it("should format date values correctly", () => {
    const tableData: TableData = {
      columns: [{ columnNumber: 1, name: "date" }],
      rows: [
        {
          rowNumber: 1,
          cells: [
            {
              column: "date",
              value: "2026-01-08T10:30:00",
            },
          ],
        },
      ],
    };

    render(<DataTable tableData={tableData} />);

    const dateCell = screen.getByText(/Jan 8, 2026/i);
    expect(dateCell).toBeInTheDocument();
  });

  it("should show only first 20 rows by default", () => {
    const tableData = createMockTableData(["column"], 25);

    render(<DataTable tableData={tableData} />);

    expect(screen.getByText("value-1-column")).toBeInTheDocument();
    expect(screen.getByText("value-20-column")).toBeInTheDocument();
    expect(screen.queryByText("value-21-column")).not.toBeInTheDocument();
  });

  it("should show 'Show more' button when there are more than 20 rows", () => {
    const tableData = createMockTableData(["column"], 25);

    render(<DataTable tableData={tableData} />);

    const showMoreButton = screen.getByTestId("show-more-button");
    expect(showMoreButton).toBeInTheDocument();
    expect(showMoreButton).toHaveTextContent(/Show more.*5 more rows/i);
  });

  it("should not show 'Show more' button when there are 20 or fewer rows", () => {
    const tableData = createMockTableData(["column"], 20);

    render(<DataTable tableData={tableData} />);

    expect(screen.queryByTestId("show-more-button")).not.toBeInTheDocument();
  });

  it("should show all rows when 'Show more' button is clicked", async () => {
    const user = userEvent.setup();
    const tableData = createMockTableData(["column"], 25);

    render(<DataTable tableData={tableData} />);

    const showMoreButton = screen.getByTestId("show-more-button");
    await user.click(showMoreButton);

    expect(screen.getByText("value-1-column")).toBeInTheDocument();
    expect(screen.getByText("value-25-column")).toBeInTheDocument();
  });

  it("should show 'Show less' button after expanding", async () => {
    const user = userEvent.setup();
    const tableData = createMockTableData(["column"], 25);

    render(<DataTable tableData={tableData} />);

    const showMoreButton = screen.getByTestId("show-more-button");
    await user.click(showMoreButton);

    const showLessButton = screen.getByTestId("show-more-button");
    expect(showLessButton).toHaveTextContent(/Show less.*20 rows/i);
  });

  it("should collapse rows when 'Show less' button is clicked", async () => {
    const user = userEvent.setup();
    const tableData = createMockTableData(["column"], 25);

    render(<DataTable tableData={tableData} />);

    const showMoreButton = screen.getByTestId("show-more-button");
    await user.click(showMoreButton);

    const showLessButton = screen.getByTestId("show-more-button");
    await user.click(showLessButton);

    expect(screen.getByText("value-1-column")).toBeInTheDocument();
    expect(screen.getByText("value-20-column")).toBeInTheDocument();
    expect(screen.queryByText("value-21-column")).not.toBeInTheDocument();
  });

  it("should handle table with no rows", () => {
    const tableData: TableData = {
      columns: [{ columnNumber: 1, name: "column" }],
      rows: [],
    };

    render(<DataTable tableData={tableData} />);

    expect(screen.getByText("Column")).toBeInTheDocument();
    expect(screen.queryByTestId("show-more-button")).not.toBeInTheDocument();
  });
});
