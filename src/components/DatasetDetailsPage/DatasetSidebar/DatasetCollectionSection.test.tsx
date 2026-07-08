import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseFeatureFlag = vi.fn();

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

import DatasetCollectionSection from "./DatasetCollectionSection";

const defaultProps = {
  displayCategory: "Math",
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
