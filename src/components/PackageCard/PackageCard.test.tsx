import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatasetPackage } from "@/data/package";
import type { DatasetUnion } from "@/types/datasets";
import PackageCard from "./PackageCard";

const mockPackage: DatasetPackage = {
  id: "pkg-1",
  title: "Climate Analysis Bundle",
  datasetIds: ["1", "2", "3"],
};

const mockDatasets: DatasetUnion[] = [
  { id: "1", title: "ERA5land", name: "ERA5land" } as DatasetUnion,
  { id: "2", title: "Meteo NOA", name: "Meteo NOA" } as DatasetUnion,
  { id: "3", title: "Climate Models", name: "Climate Models" } as DatasetUnion,
];

describe("PackageCard", () => {
  it("renders package title in chip", () => {
    render(
      <PackageCard
        datasetPackage={mockPackage}
        datasets={mockDatasets}
        isSelected={false}
        onSelectPackage={vi.fn()}
        onDeselectPackage={vi.fn()}
      />,
    );
    expect(screen.getByText("Climate Analysis Bundle")).toBeInTheDocument();
  });

  it("renders dataset names from datasets prop", () => {
    render(
      <PackageCard
        datasetPackage={mockPackage}
        datasets={mockDatasets}
        isSelected={false}
        onSelectPackage={vi.fn()}
        onDeselectPackage={vi.fn()}
      />,
    );
    expect(screen.getAllByText("ERA5land").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Meteo NOA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Climate Models").length).toBeGreaterThan(0);
  });

  it("calls onSelectPackage when Select button clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PackageCard
        datasetPackage={mockPackage}
        datasets={mockDatasets}
        isSelected={false}
        onSelectPackage={onSelect}
        onDeselectPackage={vi.fn()}
      />,
    );
    const card = container.querySelector("article");
    const selectBtn = card?.querySelector(
      'button[aria-label="Select Climate Analysis Bundle"]',
    ) as HTMLButtonElement;
    expect(selectBtn).toBeTruthy();
    fireEvent.click(selectBtn!);
    expect(onSelect).toHaveBeenCalledWith("pkg-1");
  });

  it("calls onDeselectPackage when Deselect button clicked", () => {
    const onDeselect = vi.fn();
    render(
      <PackageCard
        datasetPackage={mockPackage}
        datasets={mockDatasets}
        isSelected={true}
        onSelectPackage={vi.fn()}
        onDeselectPackage={onDeselect}
      />,
    );
    const deselectBtn = screen.getByRole("button", {
      name: "Deselect Climate Analysis Bundle",
    });
    fireEvent.click(deselectBtn);
    expect(onDeselect).toHaveBeenCalledWith("pkg-1");
  });

  it("shows Deselect button when package is selected", () => {
    render(
      <PackageCard
        datasetPackage={mockPackage}
        datasets={mockDatasets}
        isSelected={true}
        onSelectPackage={vi.fn()}
        onDeselectPackage={vi.fn()}
      />,
    );
    const deselectBtns = screen.getAllByRole("button", {
      name: "Deselect Climate Analysis Bundle",
    });
    expect(deselectBtns.length).toBeGreaterThan(0);
  });
});
