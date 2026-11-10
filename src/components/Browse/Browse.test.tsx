import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Browse from "./Browse";

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

vi.mock("./useDatasetSearchExamples", () => ({
  useDatasetSearchExamples: () => ["rainfall datasets", "Greek corpora"],
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

  const renderCustomCollection = (
    api: Partial<ReturnType<typeof baseApiMock>> = {},
  ) => {
    const apiMock = { ...baseApiMock(), ...api };
    mockUseApi.mockReturnValue(apiMock);
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
    return apiMock;
  };

  const collectionActionsButton = () =>
    screen.getByRole("button", { name: "Collection actions" });

  // Waits for the grant lookup so the panel reflects the grants, then opens it.
  const openCollectionActions = async (
    apiMock: ReturnType<typeof baseApiMock>,
  ) => {
    await waitFor(() => {
      expect(apiMock.getCollectionGrants).toHaveBeenCalledWith("123");
    });
    await userEvent.click(collectionActionsButton());
  };

  const withDeleteGrant = () => ({
    getCollectionGrants: vi.fn().mockResolvedValue(["dg_col-delete"]),
  });

  it("should show Delete Collection button when user has dg_col-delete grant", async () => {
    const apiMock = renderCustomCollection(withDeleteGrant());

    await openCollectionActions(apiMock);

    await waitFor(() => {
      expect(screen.getByText("Delete Collection")).toBeInTheDocument();
    });
  });

  it("names the collection actions button and links it to the panel it opens", async () => {
    renderCustomCollection();

    const moreButton = collectionActionsButton();
    // Disclosure pattern: the panel is a list of buttons, not an ARIA menu.
    expect(moreButton).not.toHaveAttribute("aria-haspopup");
    expect(moreButton).toHaveAttribute("aria-expanded", "false");
    expect(moreButton).not.toHaveAttribute("aria-controls");

    await userEvent.click(moreButton);

    expect(moreButton).toHaveAttribute("aria-expanded", "true");
    const panelId = moreButton.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(String(panelId))).toBeInTheDocument();

    await userEvent.click(moreButton);

    expect(moreButton).toHaveAttribute("aria-expanded", "false");
    expect(moreButton).not.toHaveAttribute("aria-controls");
  });

  it("should NOT show Delete Collection button when user does not have dg_col-delete grant", async () => {
    const apiMock = renderCustomCollection();

    await openCollectionActions(apiMock);

    await waitFor(() => {
      expect(screen.queryByText("Delete Collection")).not.toBeInTheDocument();
    });
  });

  it("should NOT check grants when isCustomCollection is false", async () => {
    const apiMock = { ...baseApiMock(), ...withDeleteGrant() };
    mockUseApi.mockReturnValue(apiMock);

    render(
      <Browse
        datasets={mockDatasets}
        title="Math Collection"
        subtitle="System collection"
        isCustomCollection={false}
      />,
    );

    await waitFor(() => {
      expect(apiMock.getCollectionGrants).not.toHaveBeenCalled();
    });
  });

  it("should open delete modal when Delete Collection is clicked", async () => {
    const apiMock = renderCustomCollection(withDeleteGrant());

    await openCollectionActions(apiMock);
    await userEvent.click(await screen.findByText("Delete Collection"));

    await waitFor(() => {
      expect(
        screen.getByText(/This operation will permanently delete/i),
      ).toBeInTheDocument();
    });
  });

  it("should call deleteCollection API and show success toast", async () => {
    const mockRefreshExtraCollections = vi.fn();
    const mockNotifyCollectionModified = vi.fn();

    mockUseCollections.mockReturnValue({
      apiCollections: [],
      extraCollections: [],
      refreshExtraCollections: mockRefreshExtraCollections,
      notifyCollectionModified: mockNotifyCollectionModified,
    });

    const apiMock = renderCustomCollection(withDeleteGrant());

    await openCollectionActions(apiMock);
    await userEvent.click(await screen.findByText("Delete Collection"));
    await userEvent.click(
      await screen.findByRole("button", { name: /^delete$/i }),
    );

    await waitFor(() => {
      expect(apiMock.deleteCollection).toHaveBeenCalledWith("123");
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
    const apiMock = renderCustomCollection({
      ...withDeleteGrant(),
      deleteCollection: vi.fn().mockRejectedValue(new Error("API Error")),
    });

    await openCollectionActions(apiMock);
    await userEvent.click(await screen.findByText("Delete Collection"));
    await userEvent.click(
      await screen.findByRole("button", { name: /^delete$/i }),
    );

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

describe("Browse – search box follows Smart search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(false);
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

  const searchBox = () => screen.getByRole("textbox");
  const frameOf = (el: HTMLElement) => el.closest("[data-smart]");

  it("asks for a description and frames the box with the gradient when on", () => {
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        isSmartSearchEnabled
      />,
    );
    expect(searchBox()).toHaveAttribute(
      "placeholder",
      "Describe what you need, e.g. “rainfall data in Central Europe”…",
    );
    expect(frameOf(searchBox())).toHaveAttribute("data-smart", "on");
  });

  it("hides sorting and filters while Smart search ranks the results", () => {
    render(
      <Browse
        datasets={[
          {
            id: "d1",
            title: "Rainfall",
            description: "",
            license: "MIT",
            size: "N/A",
            datePublished: "2024-01-01",
            category: "Math" as const,
            access: "Open Access" as const,
            lastUpdated: "2024-01-01",
            tags: [],
          },
        ]}
        title="Datasets"
        subtitle=""
        searchTerm="rainfall"
        isSmartSearchEnabled
      />,
    );
    expect(screen.queryByRole("button", { name: "Filter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Name (A-Z)" })).toBeNull();
    expect(screen.getByText(/Showing:/)).toBeInTheDocument();
  });

  it("shows the total and offers more datasets when there are more", () => {
    const onLoadMore = vi.fn();
    const one = {
      id: "d1",
      title: "Rainfall",
      description: "",
      license: "MIT",
      size: "N/A",
      datePublished: "2024-01-01",
      category: "Math" as const,
      access: "Open Access" as const,
      lastUpdated: "2024-01-01",
      tags: [],
    };
    render(
      <Browse
        datasets={[one]}
        title="Datasets"
        subtitle=""
        totalCount={201}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );
    expect(screen.getByText(/1 of 201 results/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more datasets" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("offers no size sorting", async () => {
    render(<Browse datasets={[]} title="Datasets" subtitle="" />);
    fireEvent.click(screen.getByRole("button", { name: "Name (A-Z)" }));
    expect(
      screen.getByText("Date Published (newest first)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Size (smallest first)")).toBeNull();
    expect(screen.queryByText("Size (highest first)")).toBeNull();
  });

  it("ends the search when the box is emptied by hand", () => {
    const onSearchTermChange = vi.fn();
    const onSearchTermSubmit = vi.fn();
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        searchTerm="rain"
        onSearchTermChange={onSearchTermChange}
        onSearchTermSubmit={onSearchTermSubmit}
      />,
    );
    fireEvent.change(searchBox(), { target: { value: "" } });
    expect(onSearchTermChange).toHaveBeenCalledWith("");
    expect(onSearchTermSubmit).toHaveBeenCalledWith("");
  });

  it("asks for a name or keyword and stays neutral when off", () => {
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        isSmartSearchEnabled={false}
      />,
    );
    expect(searchBox()).toHaveAttribute(
      "placeholder",
      "Search by name or keyword…",
    );
    expect(frameOf(searchBox())).toHaveAttribute("data-smart", "off");
  });
});

describe("Browse – search progress and empty results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(false);
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

  it("shows that Smart search is running, for which text, instead of an old count", () => {
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        searchTerm="rainfall data"
        appliedSearchTerm="rainfall data"
        isSmartSearchEnabled
        isLoading
        totalCount={14}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching for “rainfall data”",
    );
    expect(screen.getByText("Searching inside the data")).toBeInTheDocument();
    expect(screen.queryByText(/Showing:/)).toBeNull();
  });

  it("keeps the plain loading cards for keyword search", () => {
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        searchTerm="rain"
        appliedSearchTerm="rain"
        isLoading
      />,
    );
    expect(screen.queryByText("Searching inside the data")).toBeNull();
    expect(screen.queryByText(/Showing:/)).toBeNull();
    expect(screen.getByText("Searching…")).toBeInTheDocument();
  });

  it("explains an empty keyword result and offers Smart search", () => {
    const onSmartSearchToggle = vi.fn();
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        searchTerm="rainfall data in Central Europe"
        appliedSearchTerm="rainfall data in Central Europe"
        isSmartSearchEnabled={false}
        onSmartSearchToggle={onSmartSearchToggle}
      />,
    );
    expect(
      screen.getByText(
        "No dataset names or descriptions contain “rainfall data in Central Europe”.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Turn on Smart search" }),
    );
    expect(onSmartSearchToggle).toHaveBeenCalledWith(true);
  });

  it("explains an empty Smart search result without offering Smart search", () => {
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        searchTerm="quantum gravity"
        appliedSearchTerm="quantum gravity"
        isSmartSearchEnabled
        onSmartSearchToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No datasets found for “quantum gravity”."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Try describing what you need in other words."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Turn on Smart search" }),
    ).toBeNull();
  });

  it("announces the result count when a search finishes", () => {
    render(
      <Browse
        datasets={[]}
        title="Datasets"
        subtitle=""
        searchTerm="rain"
        appliedSearchTerm="rain"
      />,
    );
    expect(screen.getByText(/Showing:/).closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});

describe("Browse – Smart search with an empty box", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(false);
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

  const dataset = {
    id: "d1",
    title: "Rainfall",
    description: "",
    license: "MIT",
    size: "N/A",
    datePublished: "2024-01-01",
    category: "Math" as const,
    access: "Open Access" as const,
    lastUpdated: "2024-01-01",
    tags: [],
  };

  it("keeps the list and offers dataset-search examples above it", () => {
    const onSearchTermChange = vi.fn();
    const onSearchTermSubmit = vi.fn();
    render(
      <Browse
        datasets={[dataset]}
        title="Datasets"
        subtitle=""
        searchTerm=""
        isSmartSearchEnabled
        totalCount={201}
        onSearchTermChange={onSearchTermChange}
        onSearchTermSubmit={onSearchTermSubmit}
      />,
    );
    expect(screen.getByText(/1 of 201 results/)).toBeInTheDocument();
    expect(screen.queryByText("Example Searches")).toBeNull();
    expect(
      screen.getByText("Describe what you need to rank by relevance"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sorted by relevance")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Greek corpora" }));
    expect(onSearchTermChange).toHaveBeenCalledWith("Greek corpora");
    expect(onSearchTermSubmit).toHaveBeenCalledWith("Greek corpora");
  });

  it("shows no examples once a Smart search has text", () => {
    render(
      <Browse
        datasets={[dataset]}
        title="Datasets"
        subtitle=""
        searchTerm="rainfall"
        appliedSearchTerm="rainfall"
        isSmartSearchEnabled
      />,
    );
    expect(screen.queryByRole("button", { name: "Greek corpora" })).toBeNull();
    expect(screen.getByText("Sorted by relevance")).toBeInTheDocument();
  });
});
