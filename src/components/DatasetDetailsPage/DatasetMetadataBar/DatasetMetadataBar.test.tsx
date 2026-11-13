import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
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
  expect(screen.getByText("File size")).toBeInTheDocument();
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
  expect(screen.getByText("File size")).toBeInTheDocument();
  expect(screen.getByText("1.0 KB")).toBeInTheDocument();
  expect(screen.queryByText("1970-01-01")).not.toBeInTheDocument();
});
