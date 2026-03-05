import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatasetPackage } from "@/data/package";
import type { DatasetUnion } from "@/types/datasets";
import PackageCarousel from "./PackageCarousel";

const mockPackages: DatasetPackage[] = [
  { id: "pkg-1", title: "Bundle A", datasetIds: ["1", "2"] },
  { id: "pkg-2", title: "Bundle B", datasetIds: ["3"] },
];

const mockDatasets: DatasetUnion[] = [
  { id: "1", title: "DS1" } as DatasetUnion,
  { id: "2", title: "DS2" } as DatasetUnion,
  { id: "3", title: "DS3" } as DatasetUnion,
];

describe("PackageCarousel", () => {
  it("renders no packages message when packages array is empty", () => {
    render(
      <PackageCarousel
        packages={[]}
        datasets={mockDatasets}
        selectedPackageIds={[]}
        onSelectPackage={vi.fn()}
        onDeselectPackage={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No packages match your search"),
    ).toBeInTheDocument();
  });

  it("renders package cards", () => {
    render(
      <PackageCarousel
        packages={mockPackages}
        datasets={mockDatasets}
        selectedPackageIds={[]}
        onSelectPackage={vi.fn()}
        onDeselectPackage={vi.fn()}
      />,
    );
    expect(screen.getByText("Bundle A")).toBeInTheDocument();
    expect(screen.getByText("Bundle B")).toBeInTheDocument();
  });
});
