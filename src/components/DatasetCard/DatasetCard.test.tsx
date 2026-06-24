import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/data/dataset";
import DatasetCard from "./DatasetCard";

const { toggleFavorite } = vi.hoisted(() => ({ toggleFavorite: vi.fn() }));

vi.mock("@/contexts/DatasetContext", () => ({
  useDataset: () => ({
    toggleFavorite,
    isFavorite: () => false,
  }),
}));

describe("DatasetCard", () => {
  const mockDataset: Dataset = {
    id: "1",
    title: "Test Dataset",
    category: "Math",
    access: "Open Access",
    description: "Test description",
    size: "1 MB",
    lastUpdated: "2024-01-01",
    tags: ["test", "data"],
  };

  const defaultProps = {
    dataset: mockDataset,
    isSelected: false,
    onSelect: vi.fn(),
    onAddToCollection: vi.fn(),
  };

  it("should render dataset title", () => {
    render(<DatasetCard {...defaultProps} />);
    expect(screen.getByText("Test Dataset")).toBeInTheDocument();
  });

  it("should render dataset description", () => {
    render(<DatasetCard {...defaultProps} />);
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("toggles favorite via context when the star is clicked", async () => {
    const user = userEvent.setup();
    render(<DatasetCard {...defaultProps} />);

    await user.click(screen.getByLabelText("Add to favorites"));

    expect(toggleFavorite).toHaveBeenCalledWith("1");
  });
});
