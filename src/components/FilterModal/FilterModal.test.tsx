import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterState } from "@/config/filterOptions";
import FilterModal from "./FilterModal";

// Hoisted with the `vi.mock` factories below, which reference them.
const { mockUseApi, mockProcessFieldsOfScience, mockProcessLicenses } =
  vi.hoisted(() => ({
    mockUseApi: vi.fn(),
    mockProcessFieldsOfScience: vi.fn(),
    mockProcessLicenses: vi.fn(),
  }));

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

const READ_LIMIT = 300;

/**
 * ON-BUG-01 tripwire, see HierarchicalDropdown.test.tsx. A render loop in the
 * shared dropdown hangs the run instead of failing it, so the categories this
 * consumer passes down are counted and capped.
 */
function guarded(categories: HierarchicalCategory[]): HierarchicalCategory[] {
  let reads = 0;
  return new Proxy(categories, {
    get(target, property, receiver) {
      reads += 1;
      if (reads > READ_LIMIT) {
        throw new Error(
          `Field of science render loop: the categories prop was read more than ${READ_LIMIT} times`,
        );
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

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
    {
      name: "Engineering",
      code: "2",
      options: [{ value: "eng-1", label: "Civil engineering" }],
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
    mockProcessFieldsOfScience.mockReturnValue(
      guarded(mockFieldsOfScienceCategories),
    );
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

  it("offers Access options when the caller does not mark them unavailable", () => {
    render(<FilterModal {...defaultProps} />);
    expect(screen.getByRole("radio", { name: /open/i })).toBeInTheDocument();
  });

  it("explains unavailable Access filtering and never applies a stale value", async () => {
    const user = userEvent.setup();
    const onApplyFilters = vi.fn();
    const stale: FilterState = {
      ...defaultFilters,
      access: "restricted",
      license: ["MIT"],
      creationYear: { start: "2020", end: "" },
    };
    render(
      <FilterModal
        {...defaultProps}
        currentFilters={stale}
        onApplyFilters={onApplyFilters}
        accessUnavailableReason="Access filtering is unavailable."
      />,
    );

    expect(
      screen.getByText("Access filtering is unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /apply/i }));
    // Only Access is neutralized; every other filter is applied as it was.
    expect(onApplyFilters).toHaveBeenCalledWith({ ...stale, access: "" });
  });

  // ON-BUG-01 consumer coverage: the shared Field of science dropdown is also
  // rendered here, so the search that looped in dataset onboarding is exercised
  // from this consumer as well.
  describe("field of science search", () => {
    const fieldOfScienceSearch = async () =>
      (await screen.findAllByPlaceholderText("Search..."))[0];

    it("filters the field of science options without looping", async () => {
      const user = userEvent.setup();
      render(<FilterModal {...defaultProps} />);

      await user.type(await fieldOfScienceSearch(), "civil");

      expect(screen.getByLabelText("Civil engineering")).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Pure Mathematics"),
      ).not.toBeInTheDocument();
    });

    it("keeps a field of science selection while the query changes", async () => {
      const user = userEvent.setup();
      render(<FilterModal {...defaultProps} />);

      const search = await fieldOfScienceSearch();
      await user.type(search, "pure");
      await user.click(screen.getByLabelText("Pure Mathematics"));
      expect(screen.getByLabelText("Pure Mathematics")).toBeChecked();

      await user.clear(search);
      await user.type(search, "mathematics");

      expect(screen.getByLabelText("Pure Mathematics")).toBeChecked();
      expect(screen.getByLabelText("Applied Mathematics")).not.toBeChecked();
    });

    it("applies the field of science selection made after a search", async () => {
      const user = userEvent.setup();
      render(<FilterModal {...defaultProps} />);

      await user.type(await fieldOfScienceSearch(), "civil");
      await user.click(screen.getByLabelText("Civil engineering"));
      await user.click(screen.getByRole("button", { name: /apply/i }));

      expect(defaultProps.onApplyFilters).toHaveBeenCalledWith({
        ...defaultFilters,
        fieldsOfScience: ["eng-1"],
      });
    });
  });
});
