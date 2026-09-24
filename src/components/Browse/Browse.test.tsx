import { render, screen, waitFor, within } from "@testing-library/react";
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

describe("Browse - Delete Collection Feature", () => {
  const mockDatasets = [
    {
      id: "1",
      title: "Test Dataset",
      description: "Test description",
      license: "MIT",
      size: "1 MB",
      datePublished: "2024-01-01",
      category: "Math" as const,
      access: "Open Access" as const,
      lastUpdated: "2024-01-01",
      tags: ["test"],
    },
  ];

  const baseApiMock = () => ({
    hasToken: true,
    getCollectionGrants: vi.fn().mockResolvedValue([]),
    getFieldsOfScience: vi.fn().mockResolvedValue([]),
    getLicenses: vi.fn().mockResolvedValue([]),
    deleteCollection: vi.fn().mockResolvedValue({}),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: vi.fn(),
    });

    mockUseCollections.mockReturnValue({
      apiCollections: [],
      extraCollections: [],
      refreshExtraCollections: vi.fn(),
      notifyCollectionModified: vi.fn(),
    });
  });

  it("should show Delete Collection button when user has dg_col-delete grant", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);

    mockUseApi.mockReturnValue({
      ...baseApiMock(),
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText("Delete Collection")).toBeInTheDocument();
    });
  });

  it("should NOT show Delete Collection button when user does not have dg_col-delete grant", async () => {
    const mockGetCollectionGrants = vi.fn().mockResolvedValue([]);

    mockUseApi.mockReturnValue({
      ...baseApiMock(),
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    await waitFor(() => {
      expect(screen.queryByText("Delete Collection")).not.toBeInTheDocument();
    });
  });

  it("should NOT check grants when isCustomCollection is false", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);

    mockUseApi.mockReturnValue({
      ...baseApiMock(),
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Math Collection"
        subtitle="System collection"
        isCustomCollection={false}
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).not.toHaveBeenCalled();
    });
  });

  it("should open delete modal when Delete Collection is clicked", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);

    mockUseApi.mockReturnValue({
      ...baseApiMock(),
      getCollectionGrants: mockGetCollectionGrants,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    const deleteCollectionButton = await screen.findByText("Delete Collection");
    await userEvent.click(deleteCollectionButton);

    await waitFor(() => {
      expect(
        screen.getByText(/This operation will permanently delete/i),
      ).toBeInTheDocument();
    });
  });

  it("should call deleteCollection API and show success toast", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);
    const mockDeleteCollection = vi.fn().mockResolvedValue({});
    const mockRefreshExtraCollections = vi.fn();
    const mockNotifyCollectionModified = vi.fn();
    const mockPush = vi.fn();

    mockUseApi.mockReturnValue({
      ...baseApiMock(),
      getCollectionGrants: mockGetCollectionGrants,
      deleteCollection: mockDeleteCollection,
    });

    mockUseRouter.mockReturnValue({
      push: mockPush,
    });

    mockUseCollections.mockReturnValue({
      apiCollections: [],
      extraCollections: [],
      refreshExtraCollections: mockRefreshExtraCollections,
      notifyCollectionModified: mockNotifyCollectionModified,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    const deleteCollectionButton = await screen.findByText("Delete Collection");
    await userEvent.click(deleteCollectionButton);

    const confirmDeleteButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(mockDeleteCollection).toHaveBeenCalledWith("123");
      expect(mockRefreshExtraCollections).toHaveBeenCalled();
      expect(mockNotifyCollectionModified).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByText("Collection deleted successfully!"),
      ).toBeInTheDocument();
    });
  });

  it("should show error toast when deletion fails", async () => {
    const mockGetCollectionGrants = vi
      .fn()
      .mockResolvedValue(["dg_col-delete"]);
    const mockDeleteCollection = vi
      .fn()
      .mockRejectedValue(new Error("API Error"));

    mockUseApi.mockReturnValue({
      ...baseApiMock(),
      getCollectionGrants: mockGetCollectionGrants,
      deleteCollection: mockDeleteCollection,
    });

    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />,
    );

    await waitFor(() => {
      expect(mockGetCollectionGrants).toHaveBeenCalledWith("123");
    });

    const moreButton = screen.getByRole("button", { name: "" });
    await userEvent.click(moreButton);

    const deleteCollectionButton = await screen.findByText("Delete Collection");
    await userEvent.click(deleteCollectionButton);

    const confirmDeleteButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to delete collection/i),
      ).toBeInTheDocument();
    });
  });
});

describe("Browse – generalChat flag (Hide general chat)", () => {
  const mockDatasets = [
    {
      id: "1",
      title: "Test Dataset",
      description: "Test description",
      license: "MIT",
      size: "1 MB",
      datePublished: "2024-01-01",
      category: "Math" as const,
      access: "Open Access" as const,
      lastUpdated: "2024-01-01",
      tags: ["test"],
    },
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
      hasToken: false,
      getCollectionGrants: vi.fn().mockResolvedValue([]),
      getFieldsOfScience: vi.fn().mockResolvedValue([]),
    });
  });

  const renderBrowse = () =>
    render(<Browse datasets={mockDatasets} title="Browse" subtitle="" />);

  it("shows X Selected button when flag is OFF (false)", () => {
    mockUseFeatureFlag.mockReturnValue(false);
    renderBrowse();
    expect(
      screen.getByRole("button", { name: /selected/i }),
    ).toBeInTheDocument();
  });

  it("hides X Selected button when flag is ON (true)", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderBrowse();
    expect(screen.queryByRole("button", { name: /selected/i })).toBeNull();
  });
});

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
