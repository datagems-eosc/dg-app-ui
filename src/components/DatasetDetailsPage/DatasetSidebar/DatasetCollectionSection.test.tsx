import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseFeatureFlag = vi.fn();

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

import DatasetCollectionSection from "./DatasetCollectionSection";

const defaultProps = {
  displayCollection: "Meteo",
  onAddClick: vi.fn(),
};

describe("DatasetCollectionSection – generalChat flag (Hide general chat)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Add button when flag is OFF (false)", () => {
    mockUseFeatureFlag.mockReturnValue(false);
    render(<DatasetCollectionSection {...defaultProps} />);
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("hides Add button when flag is ON (true)", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(<DatasetCollectionSection {...defaultProps} />);
    expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
  });
});

describe("DatasetCollectionSection – no displayable collection (#251)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits the whole section when there is neither a label nor Add", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { container } = render(
      <DatasetCollectionSection {...defaultProps} displayCollection="" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the heading and a working Add action without a badge", () => {
    mockUseFeatureFlag.mockReturnValue(false);
    const onAddClick = vi.fn();
    const { container } = render(
      <DatasetCollectionSection displayCollection="" onAddClick={onAddClick} />,
    );
    expect(screen.getByText("Collection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onAddClick).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("CollectionAdd");
  });

  it("shows a genuine label without the Add action", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(<DatasetCollectionSection {...defaultProps} />);
    expect(screen.getByText("Meteo")).toBeInTheDocument();
  });
});
