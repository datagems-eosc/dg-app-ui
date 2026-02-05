import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/data/dataset";
import DatasetCard from "./DatasetCard";

vi.mock("@/contexts/DatasetContext", () => ({
  useDataset: () => ({
    toggleFavorite: vi.fn(),
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
    onDeselect: vi.fn(),
    onAddToCollection: vi.fn(),
    isFavorite: false,
    onAddToFavorites: vi.fn(),
    onRemoveFromFavorites: vi.fn(),
    favoriteDatasetIds: [],
    favoritesCollectionId: "",
    hasFetchedFavorites: false,
  };

  it("should render dataset title", () => {
    render(<DatasetCard {...defaultProps} />);
    expect(screen.getByText("Test Dataset")).toBeInTheDocument();
  });

  it("should render dataset description", () => {
    render(<DatasetCard {...defaultProps} />);
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("calls onAddToFavorites when star is clicked", async () => {
    const user = userEvent.setup();
    const onAddToFavorites = vi.fn().mockResolvedValue(undefined);
    render(
      <DatasetCard
        {...defaultProps}
        isFavorite={false}
        favoritesCollectionId="favorites-1"
        hasFetchedFavorites={true}
        onAddToFavorites={onAddToFavorites}
        onRemoveFromFavorites={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Add to favorites"));

    expect(onAddToFavorites).toHaveBeenCalledWith("1");
  });

  it("should call onSelect when card is clicked and not selected", async () => {
    const user = userEvent.setup();
    render(<DatasetCard {...defaultProps} />);

    const card = screen.getByText("Test Dataset").closest("div");
    if (card) {
      await user.click(card);
    }

    expect(defaultProps.onSelect).toHaveBeenCalledWith("1");
  });

  it("should call onDeselect when card is clicked and selected", async () => {
    const user = userEvent.setup();
    render(<DatasetCard {...defaultProps} isSelected={true} />);

    const card = screen.getByText("Test Dataset").closest("div");
    if (card) {
      await user.click(card);
    }

    expect(defaultProps.onDeselect).toHaveBeenCalledWith("1");
  });
});
