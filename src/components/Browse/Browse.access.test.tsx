import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultFilters } from "@/config/filterOptions";
import { mapApiDatasetToDataset } from "@/lib/datasetMapping";
import Browse, { ACCESS_FILTER_UNAVAILABLE_MESSAGE } from "./Browse";

const mockUseApi = vi.fn();
const mockUseCollections = vi.fn();
const mockUseRouter = vi.fn();
const mockUseFeatureFlag = vi.fn().mockReturnValue(false);

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

vi.mock("../DatasetCard", () => ({
  default: () => null,
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => mockUseCollections(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => "/collections/custom/123",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Browse - Access filter without publication evidence", () => {
  // Real mapper output: the caller's own Browse permission is not publication
  // evidence, so neither dataset carries a public/restricted state.
  const mapped = [
    mapApiDatasetToDataset({
      id: "a",
      name: "Callers can browse",
      permissions: ["browsedataset"],
    }),
    mapApiDatasetToDataset({
      id: "b",
      name: "No caller grant",
      permissions: [],
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: vi.fn() });
    mockUseCollections.mockReturnValue({
      apiCollections: [],
      extraCollections: [],
      refreshExtraCollections: vi.fn(),
      notifyCollectionModified: vi.fn(),
    });
    mockUseApi.mockReturnValue({
      hasToken: true,
      getCollectionGrants: vi.fn().mockResolvedValue([]),
      getFieldsOfScience: vi.fn().mockResolvedValue([]),
      getLicenses: vi.fn().mockResolvedValue([]),
    });
  });

  it.each(["open", "restricted"])(
    "does not apply a stale %s selection to unknown datasets, and keeps other filters",
    (access) => {
      expect(mapped.every((dataset) => dataset.access === undefined)).toBe(
        true,
      );
      render(
        <Browse
          datasets={mapped as never}
          title="Browse"
          subtitle="All datasets"
          filters={{
            ...getDefaultFilters(),
            access,
            creationYear: { start: "2020", end: "" },
          }}
        />,
      );

      expect(screen.getByText(/2 results/)).toBeInTheDocument();
      expect(
        screen.getByText(ACCESS_FILTER_UNAVAILABLE_MESSAGE),
      ).toBeInTheDocument();
      // The unsupported selection is not shown as active; the others are.
      const active = screen.getByRole("list", { name: "Active filters" });
      expect(
        within(active).queryByRole("listitem", { name: /^Access/ }),
      ).toBeNull();
      expect(
        within(active).getByRole("listitem", {
          name: "Creation Year: 2020-...",
        }),
      ).toBeInTheDocument();
    },
  );

  it("shows Access as unavailable in the filter dialog and never re-applies it", async () => {
    const user = userEvent.setup();
    const onApplyFilters = vi.fn();
    render(
      <Browse
        datasets={mapped as never}
        title="Browse"
        subtitle="All datasets"
        onApplyFilters={onApplyFilters}
        filters={{ ...getDefaultFilters(), access: "open", license: ["MIT"] }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByRole("note")).toHaveTextContent(
      ACCESS_FILTER_UNAVAILABLE_MESSAGE,
    );

    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({ access: "", license: ["MIT"] }),
    );
  });

  it("says nothing about Access when no selection is present", () => {
    render(
      <Browse
        datasets={mapped as never}
        title="Browse"
        subtitle="All datasets"
      />,
    );
    expect(screen.getByText(/2 results/)).toBeInTheDocument();
    expect(screen.queryByText(ACCESS_FILTER_UNAVAILABLE_MESSAGE)).toBeNull();
  });
});
