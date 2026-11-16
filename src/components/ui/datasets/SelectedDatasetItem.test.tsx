import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatasetUnion } from "@/types/datasets";
import SelectedDatasetItem from "./SelectedDatasetItem";

const renderItem = (dataset: Record<string, unknown>) =>
  render(
    <SelectedDatasetItem
      dataset={{ id: "d1", title: "Rain", ...dataset } as DatasetUnion}
      isExpanded={false}
      onToggleExpanded={vi.fn()}
      onRemoveDataset={vi.fn()}
    />,
  );

describe("SelectedDatasetItem access", () => {
  it("shows the dataset's own access", () => {
    renderItem({ access: "Open Access" });

    expect(screen.getByText("Open Access")).toBeInTheDocument();
  });

  it("shows no access when the dataset has none", () => {
    renderItem({ permissions: [] });

    expect(screen.queryByText("Restricted")).toBeNull();
    expect(screen.queryByText("Open Access")).toBeNull();
  });

  it("does not show the caller's permissions as access", () => {
    renderItem({ permissions: ["browsedataset"] });

    expect(screen.queryByText("Open Access")).toBeNull();
  });
});
