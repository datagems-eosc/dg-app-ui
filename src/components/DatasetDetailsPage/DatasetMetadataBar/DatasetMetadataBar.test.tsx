import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { DatasetPlus } from "@/data/dataset";
import DatasetMetadataBar from "./DatasetMetadataBar";

const dataset: DatasetPlus = {
  id: "pdf",
  title: "Nursing",
  category: "Math",
  description: "",
  tags: [],
  size: "",
  lastUpdated: "",
  profileRaw: {
    nodes: [
      {
        id: "file",
        labels: ["cr:FileObject"],
        properties: { encodingFormat: "application/pdf" },
      },
    ],
    edges: [],
  },
};

it("shows the profile's PDF format instead of the fixed CSV/PDF list", () => {
  render(<DatasetMetadataBar dataset={dataset} />);
  expect(screen.getByText("PDF", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText("CSV, PDF")).not.toBeInTheDocument();
});

it("omits missing metadata and invalid dates without leaving a bar", () => {
  const { container } = render(
    <DatasetMetadataBar
      dataset={{
        ...dataset,
        datePublished: undefined,
        lastUpdated: "invalid",
        profileRaw: null,
      }}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});

it("preserves real dates and zero, and uses File size for a known sum", () => {
  const { rerender } = render(
    <DatasetMetadataBar
      dataset={{
        ...dataset,
        datePublished: "1970-01-01T00:00:00Z",
        lastUpdated: "2026-11-10T12:00:00Z",
        profileRaw: {
          nodes: [
            {
              id: "zero",
              labels: ["cr:FileObject"],
              properties: { contentSize: "0 B" },
            },
          ],
        },
      }}
    />,
  );
  expect(screen.getByText("1970-01-01")).toBeInTheDocument();
  expect(screen.queryByText("Last updated")).not.toBeInTheDocument();
  expect(screen.queryByText("2026-11-10")).not.toBeInTheDocument();
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.getByText("0.0 B")).toBeInTheDocument();
  rerender(
    <DatasetMetadataBar
      dataset={{
        ...dataset,
        profileRaw: {
          nodes: [
            {
              id: "a",
              labels: ["cr:FileObject"],
              properties: { contentSize: 1024 },
            },
            { id: "b", labels: ["cr:FileObject"], properties: {} },
          ],
        },
      }}
    />,
  );
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.getByText("1.0 KB")).toBeInTheDocument();
  expect(screen.queryByText("1970-01-01")).not.toBeInTheDocument();
});

const fileNode = (
  id: string,
  labels: string[],
  properties: Record<string, unknown> = {},
) => ({ id, labels: ["cr:FileObject", ...labels], properties });

const withNodes = (nodes: ReturnType<typeof fileNode>[]): DatasetPlus => ({
  ...dataset,
  datePublished: "2017-07-01",
  profileRaw: { nodes, edges: [] },
});

const fact = (label: string) =>
  screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;

it("shows Added, Size, Format and Files in that order", () => {
  render(
    <DatasetMetadataBar
      dataset={withNodes([
        fileNode("a", ["JSON"], {
          encodingFormat: "application/json",
          contentSize: 2048,
        }),
        fileNode("b", ["JSON"], {
          encodingFormat: "application/json",
          contentSize: 2048,
        }),
      ])}
    />,
  );
  expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
    "Added",
    "Size",
    "Format",
    "Files",
  ]);
  expect(within(fact("Added")).getByText("2017-07-01")).toBeInTheDocument();
  expect(within(fact("Size")).getByText("4.0 KB")).toBeInTheDocument();
  expect(within(fact("Format")).getByText("JSON")).toBeInTheDocument();
  expect(
    within(fact("Files")).getByRole("button", {
      name: "2 files, go to Inside this dataset",
    }),
  ).toHaveTextContent("2");
});

it("names several formats in the plural", () => {
  render(
    <DatasetMetadataBar
      dataset={withNodes([
        fileNode("a", [], { encodingFormat: "text/csv" }),
        fileNode("b", [], { encodingFormat: "application/pdf" }),
      ])}
    />,
  );
  expect(within(fact("Formats")).getByText("CSV, PDF")).toBeInTheDocument();
});

it("counts a database's tables instead of files", () => {
  render(
    <DatasetMetadataBar
      dataset={withNodes(
        ["t1", "t2", "t3"].map((id) =>
          fileNode(id, ["Table", "Data"], {
            name: id,
            encodingFormat: "text/sql",
          }),
        ),
      )}
    />,
  );
  expect(screen.queryByText("Files")).not.toBeInTheDocument();
  expect(within(fact("Tables")).getByRole("button")).toHaveTextContent("3");
  expect(within(fact("Format")).getByText("SQL database")).toBeInTheDocument();
});

it("counts a workbook as one file, not its sheets", () => {
  const excel =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  render(
    <DatasetMetadataBar
      dataset={withNodes([
        fileNode("book", ["EXCEL"], { name: "a.xlsx", encodingFormat: excel }),
        fileNode("s1", ["Sheet"], { name: "Sheet1", encodingFormat: excel }),
        fileNode("s2", ["Sheet"], { name: "Sheet2", encodingFormat: excel }),
      ])}
    />,
  );
  expect(within(fact("File")).getByRole("button")).toHaveTextContent("1");
  expect(
    within(fact("File")).getByRole("button", {
      name: "1 file, go to Inside this dataset",
    }),
  ).toBeInTheDocument();
});

it("omits the count when the profile lists no files", () => {
  render(
    <DatasetMetadataBar
      dataset={{
        ...dataset,
        datePublished: "2020-01-01",
        profileRaw: { nodes: [] },
      }}
    />,
  );
  expect(screen.queryByText(/^Files?$/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("moves to the dataset contents when the count is chosen", () => {
  const target = document.createElement("section");
  target.id = "dataset-contents";
  target.tabIndex = -1;
  target.scrollIntoView = vi.fn();
  document.body.append(target);
  render(<DatasetMetadataBar dataset={withNodes([fileNode("a", [])])} />);
  fireEvent.click(screen.getByRole("button", { name: /go to Inside/ }));
  expect(target.scrollIntoView).toHaveBeenCalled();
  expect(target).toHaveFocus();
  target.remove();
});
