import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { DataQualityReport } from "@/types/filePreview";
import DataQualityTab from "./DataQualityTab";

it("shows both findings for a reported column and discloses the actual examples", async () => {
  const user = userEvent.setup();
  render(
    <DataQualityTab
      columns={[]}
      dataQuality={{
        status: "available",
        summary: "Two patterns were detected.",
        findings: [
          {
            id: "a",
            column: "Keywords",
            category: "format_inconsistency",
            description: "Unexpected format",
            affectedRows: 1234,
            examples: [
              { row: 4, value: false },
              { row: 5, value: null },
              { row: 6, value: 0 },
            ],
          },
          {
            id: "b",
            column: "Keywords",
            category: "missing_value",
            description: "Missing keywords",
            affectedRows: 0,
          },
        ],
      }}
    />,
  );

  expect(screen.getByText("Two patterns were detected.")).toBeInTheDocument();
  const format = screen.getByText("Format inconsistency").closest("summary");
  expect(format).toBeInTheDocument();
  if (!format) throw new Error("Expected a finding disclosure");
  await user.click(format);
  expect(format.parentElement).toHaveAttribute("open");
  expect(screen.getByText("Unexpected format")).toBeInTheDocument();
  expect(screen.getByText("Affected rows: 1,234")).toBeInTheDocument();
  const examples = within(
    screen.getByRole("table", { name: "Reported examples" }),
  );
  expect(examples.getByRole("row", { name: "4 false" })).toBeInTheDocument();
  expect(examples.getByRole("row", { name: "5 Empty" })).toBeInTheDocument();
  expect(examples.getByRole("row", { name: "6 0" })).toBeInTheDocument();
  expect(screen.getByText("Missing values")).toBeInTheDocument();
  expect(screen.queryByText("Birth Date")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Error Report" }),
  ).not.toBeInTheDocument();
});

it.each<[DataQualityReport, string]>([
  [
    { status: "available", summary: "Completed check.", findings: [] },
    "No data quality issues found.",
  ],
  [{ status: "unavailable" }, "No data quality report available."],
  [{ status: "invalid" }, "The data quality report could not be loaded."],
])(
  "distinguishes an empty report from absent or invalid data",
  (dataQuality, message) => {
    render(<DataQualityTab dataQuality={dataQuality} columns={[]} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Birth Date")).not.toBeInTheDocument();
  },
);
