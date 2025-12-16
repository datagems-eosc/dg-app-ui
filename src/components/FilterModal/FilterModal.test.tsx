import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterState } from "@/config/filterOptions";
import FilterModal from "./FilterModal";

const mockUseApi = vi.fn();
const mockProcessFieldsOfScience = vi.fn();
const mockProcessLicenses = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("@/config/filterOptions", async () => {
  const actual = await vi.importActual("@/config/filterOptions");
  return {
    ...actual,
    processFieldsOfScience: mockProcessFieldsOfScience,
    processLicenses: mockProcessLicenses,
  };
});

describe("FilterModal", () => {
  const mockFieldsOfScienceCategories: HierarchicalCategory[] = [
    {
      name: "Mathematics",
      code: "1",
      options: [
        { value: "math-1", label: "Pure Mathematics" },
        { value: "math-2", label: "Applied Mathematics" },
      ],
    },
  ];

  const mockLicenses = [
    { value: "MIT", label: "MIT License" },
    { value: "Apache-2.0", label: "Apache 2.0" },
  ];

  const defaultFilters: FilterState = {
    access: "",
    creationYear: { start: "", end: "" },
    datasetSize: { start: "", end: "" },
    fieldsOfScience: [],
    license: [],
  };

  const defaultProps = {
    isVisible: true,
    onClose: vi.fn(),
    onApplyFilters: vi.fn(),
    currentFilters: defaultFilters,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockReturnValue({
      hasToken: true,
      getFieldsOfScience: vi.fn().mockResolvedValue([]),
      getLicenses: vi.fn().mockResolvedValue([]),
    });
    mockProcessFieldsOfScience.mockReturnValue(mockFieldsOfScienceCategories);
    mockProcessLicenses.mockReturnValue(mockLicenses);
  });

  it("should not render when isVisible is false", () => {
    const { container } = render(
      <FilterModal {...defaultProps} isVisible={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render modal when isVisible is true", () => {
    render(<FilterModal {...defaultProps} />);
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterModal {...defaultProps} />);

    const closeButton = screen.getByLabelText("Close filters");
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterModal {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call onApplyFilters when apply button is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterModal {...defaultProps} />);

    const applyButton = screen.getByRole("button", { name: /apply/i });
    await user.click(applyButton);

    expect(defaultProps.onApplyFilters).toHaveBeenCalledWith(defaultFilters);
  });
});
