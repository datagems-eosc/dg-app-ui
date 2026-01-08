import { render, screen } from "@testing-library/react";
import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import { describe, expect, it, vi } from "vitest";
import type { FilterState } from "@/config/filterOptions";
import ActiveFilters from "./ActiveFilters";

describe("ActiveFilters", () => {
  const mockFieldsOfScienceCategories: HierarchicalCategory[] = [
    {
      name: "Mathematics",
      code: "1",
      options: [
        { value: "math-1", label: "Pure Mathematics" },
        { value: "math-2", label: "Applied Mathematics" },
      ],
    },
    {
      name: "Physics",
      code: "2",
      options: [
        { value: "physics-1", label: "Quantum Physics" },
        { value: "physics-2", label: "Classical Physics" },
      ],
    },
  ];

  const mockLicenses = [
    { value: "MIT", label: "MIT License" },
    { value: "Apache-2.0", label: "Apache 2.0" },
    { value: "GPL-3.0", label: "GPL 3.0" },
  ];

  const defaultProps = {
    filters: {
      access: "",
      creationYear: { start: "", end: "" },
      datasetSize: { start: "", end: "" },
      fieldsOfScience: [],
      license: [],
    } as FilterState,
    fieldsOfScienceCategories: mockFieldsOfScienceCategories,
    licenses: mockLicenses,
    onRemoveFilter: vi.fn(),
  };

  it("should return null when showSearchAndFilters is false", () => {
    const { container } = render(
      <ActiveFilters {...defaultProps} showSearchAndFilters={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should return null when there are no active filters", () => {
    const { container } = render(<ActiveFilters {...defaultProps} />);

    expect(container.firstChild).toBeNull();
  });

  it("should render access filter for open access", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      access: "open",
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Access:")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("should render creation year filter with both start and end", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      creationYear: { start: "2020", end: "2024" },
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Creation Year:")).toBeInTheDocument();
    expect(screen.getByText("2020-2024")).toBeInTheDocument();
  });

  it("should render creation year filter with only start year", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      creationYear: { start: "2020", end: "" },
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Creation Year:")).toBeInTheDocument();
    expect(screen.getByText("2020-...")).toBeInTheDocument();
  });

  it("should render creation year filter with only end year", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      creationYear: { start: "", end: "2024" },
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Creation Year:")).toBeInTheDocument();
    expect(screen.getByText("...-2024")).toBeInTheDocument();
  });

  it("should render dataset size filter with both min and max", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      datasetSize: { start: "100", end: "500" },
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Dataset Size:")).toBeInTheDocument();
    expect(screen.getByText("100 MB - 500 MB")).toBeInTheDocument();
  });

  it("should render dataset size filter with only min", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      datasetSize: { start: "100", end: "" },
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Dataset Size:")).toBeInTheDocument();
    expect(screen.getByText("100 MB - ∞")).toBeInTheDocument();
  });

  it("should render dataset size filter with only max", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      datasetSize: { start: "", end: "500" },
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Dataset Size:")).toBeInTheDocument();
    expect(screen.getByText("0 MB - 500 MB")).toBeInTheDocument();
  });

  it("should render fields of science filter with single selection", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      fieldsOfScience: ["math-1"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Field of Science:")).toBeInTheDocument();
    expect(screen.getByText("Pure Mathematics")).toBeInTheDocument();
  });

  it("should render fields of science filter with two selections", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      fieldsOfScience: ["math-1", "physics-1"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Field of Science:")).toBeInTheDocument();
    expect(
      screen.getByText("Pure Mathematics, Quantum Physics"),
    ).toBeInTheDocument();
  });

  it("should render fields of science filter with more than two selections (truncated)", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      fieldsOfScience: ["math-1", "math-2", "physics-1"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Field of Science:")).toBeInTheDocument();
    expect(
      screen.getByText("Pure Mathematics, Applied Mathematics +1 more"),
    ).toBeInTheDocument();
  });

  it("should show tooltip for truncated fields of science filter", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      fieldsOfScience: ["math-1", "math-2", "physics-1"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    const chip = screen
      .getByText("Pure Mathematics, Applied Mathematics +1 more")
      .closest("div");
    expect(chip).toBeInTheDocument();
  });

  it("should render license filter with single selection", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      license: ["MIT"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("License:")).toBeInTheDocument();
    expect(screen.getByText("MIT License")).toBeInTheDocument();
  });

  it("should render license filter with two selections", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      license: ["MIT", "Apache-2.0"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("License:")).toBeInTheDocument();
    expect(screen.getByText("MIT License, Apache 2.0")).toBeInTheDocument();
  });

  it("should render license filter with more than two selections (truncated)", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      license: ["MIT", "Apache-2.0", "GPL-3.0"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("License:")).toBeInTheDocument();
    expect(
      screen.getByText("MIT License, Apache 2.0 +1 more"),
    ).toBeInTheDocument();
  });

  it("should show tooltip for truncated license filter", () => {
    const filters: FilterState = {
      ...defaultProps.filters,
      license: ["MIT", "Apache-2.0", "GPL-3.0"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    const chip = screen
      .getByText("MIT License, Apache 2.0 +1 more")
      .closest("div");
    expect(chip).toBeInTheDocument();
  });

  it("should render multiple filters at once", () => {
    const filters: FilterState = {
      access: "open",
      creationYear: { start: "2020", end: "2024" },
      datasetSize: { start: "100", end: "500" },
      fieldsOfScience: ["math-1"],
      license: ["MIT"],
    };

    render(<ActiveFilters {...defaultProps} filters={filters} />);

    expect(screen.getByText("Access:")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Creation Year:")).toBeInTheDocument();
    expect(screen.getByText("2020-2024")).toBeInTheDocument();
    expect(screen.getByText("Dataset Size:")).toBeInTheDocument();
    expect(screen.getByText("100 MB - 500 MB")).toBeInTheDocument();
    expect(screen.getByText("Field of Science:")).toBeInTheDocument();
    expect(screen.getByText("Pure Mathematics")).toBeInTheDocument();
    expect(screen.getByText("License:")).toBeInTheDocument();
    expect(screen.getByText("MIT License")).toBeInTheDocument();
  });
});
