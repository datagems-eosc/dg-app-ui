import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

vi.mock("@/contexts/DatasetContext", () => ({
  useDataset: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }),
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

// Router, collections and a signed-out API: enough for Browse to render.
const setDefaultBrowseMocks = () => {
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
};

describe("Browse - Delete Collection Feature", () => {
  const baseApiMock = () => ({
    hasToken: true,
    getCollectionGrants: vi.fn().mockResolvedValue([]),
    getFieldsOfScience: vi.fn().mockResolvedValue([]),
    getLicenses: vi.fn().mockResolvedValue([]),
    deleteCollection: vi.fn().mockResolvedValue({}),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultBrowseMocks();
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

  // Waits until every grant lookup has resolved, so the panel reflects the
  // grants, then opens it.
  const openCollectionActions = async (
    apiMock: ReturnType<typeof baseApiMock>,
  ) => {
    await waitFor(() => {
      expect(apiMock.getCollectionGrants).toHaveBeenCalledWith("123");
    });
    await act(async () => {
      await Promise.all(
        apiMock.getCollectionGrants.mock.results.map((result) => result.value),
      );
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

  it("closes the collection actions panel on a click outside it", async () => {
    renderCustomCollection();
    const moreButton = collectionActionsButton();
    await userEvent.click(moreButton);
    const panelId = String(moreButton.getAttribute("aria-controls"));
    expect(document.getElementById(panelId)).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(moreButton).toHaveAttribute("aria-expanded", "false");
    expect(moreButton).not.toHaveAttribute("aria-controls");
    expect(document.getElementById(panelId)).not.toBeInTheDocument();
  });

  it("should NOT show Delete Collection button when user does not have dg_col-delete grant", async () => {
    const apiMock = renderCustomCollection();

    await openCollectionActions(apiMock);

    await waitFor(() => {
      expect(screen.queryByText("Delete Collection")).not.toBeInTheDocument();
    });
  });

  it("offers only collection actions that do something", async () => {
    const apiMock = renderCustomCollection();

    await openCollectionActions(apiMock);

    const panel = document.getElementById(
      String(collectionActionsButton().getAttribute("aria-controls")),
    ) as HTMLElement;
    expect(
      Array.from(panel.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["Select All", "Rename", "Manage permissions"]);
  });

  it("offers no permissions entry for a collection without an id", async () => {
    mockUseApi.mockReturnValue(baseApiMock());
    render(
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionName="Test Collection"
      />,
    );

    await userEvent.click(collectionActionsButton());

    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.queryByText("Manage permissions")).toBeNull();
  });

  it("asks for the grants once when the collection re-renders unchanged", async () => {
    // Like the real hook: a new object every render, the same functions.
    const apiMock = baseApiMock();
    mockUseApi.mockImplementation(() => ({ ...apiMock }));
    const view = (
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId="123"
        collectionName="Test Collection"
      />
    );
    const { rerender } = render(view);
    await waitFor(() => {
      expect(apiMock.getCollectionGrants).toHaveBeenCalledTimes(1);
    });

    rerender(view);
    rerender(view);
    await act(async () => {});

    expect(apiMock.getCollectionGrants).toHaveBeenCalledTimes(1);
  });

  it("asks for the grants again when the collection changes", async () => {
    const apiMock = baseApiMock();
    mockUseApi.mockImplementation(() => ({ ...apiMock }));
    const viewFor = (collectionId: string) => (
      <Browse
        datasets={mockDatasets}
        title="Test Collection"
        subtitle="Test subtitle"
        isCustomCollection={true}
        collectionId={collectionId}
        collectionName="Test Collection"
      />
    );
    const { rerender } = render(viewFor("123"));
    await waitFor(() => {
      expect(apiMock.getCollectionGrants).toHaveBeenCalledWith("123");
    });

    rerender(viewFor("456"));

    await waitFor(() => {
      expect(apiMock.getCollectionGrants).toHaveBeenLastCalledWith("456");
    });
    expect(apiMock.getCollectionGrants).toHaveBeenCalledTimes(2);
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

describe("Browse selection availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultBrowseMocks();
  });

  const renderBrowse = () =>
    render(<Browse datasets={mockDatasets} title="Browse" subtitle="" />);

  it("shows the selection counter with default settings", () => {
    mockUseFeatureFlag.mockReturnValue(false);
    renderBrowse();
    expect(
      screen.getByRole("button", { name: /selected/i }),
    ).toBeInTheDocument();
  });

  it("keeps the selection counter available with feature overrides enabled", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderBrowse();
    expect(
      screen.getByRole("button", { name: "0 Selected" }),
    ).toBeInTheDocument();
  });

  it("keeps dataset selection available when feature overrides are enabled", async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderBrowse();
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(
      screen.getByRole("button", { name: "1 Selected" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Deselect" }));
    expect(
      screen.getByRole("button", { name: "0 Selected" }),
    ).toBeInTheDocument();
  });

  it("keeps Add available with feature overrides enabled", async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderBrowse();
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Add to Collection")).toBeInTheDocument();
  });

  it.each(["grid", "list"] as const)(
    "respects caller suppression of Add in %s view",
    (viewMode) => {
      window.localStorage.setItem("browseViewMode", viewMode);
      mockUseFeatureFlag.mockReturnValue(true);
      render(
        <Browse
          datasets={mockDatasets}
          title="Browse"
          subtitle=""
          showAddButton={false}
        />,
      );
      window.localStorage.removeItem("browseViewMode");
      expect(
        screen.queryByRole("button", { name: "Add" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Select" }),
      ).toBeInTheDocument();
    },
  );

  it("toggles the selected panel through the existing callbacks", async () => {
    const onReopenSidebar = vi.fn();
    const onCloseSidebar = vi.fn();
    const { rerender } = render(
      <Browse
        datasets={[]}
        title="Browse"
        subtitle=""
        onReopenSidebar={onReopenSidebar}
        onCloseSidebar={onCloseSidebar}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "0 Selected" }));
    expect(onReopenSidebar).toHaveBeenCalledTimes(1);
    rerender(
      <Browse
        datasets={[]}
        title="Browse"
        subtitle=""
        showSelectedPanel
        onReopenSidebar={onReopenSidebar}
        onCloseSidebar={onCloseSidebar}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "0 Selected" }));
    await waitFor(() => expect(onCloseSidebar).toHaveBeenCalledTimes(1));
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

describe("Browse – selected datasets actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(false);
    setDefaultBrowseMocks();
  });

  const renderWithSelection = () =>
    render(
      <Browse
        datasets={mockDatasets}
        title="Browse"
        subtitle=""
        selectedDatasets={["1"]}
      />,
    );

  const selectedActionsButton = () =>
    screen.getByRole("button", { name: "Selected dataset actions" });

  it("names the actions button and links it to the panel it opens", async () => {
    renderWithSelection();

    const actionsButton = selectedActionsButton();
    expect(actionsButton).toHaveAttribute("aria-expanded", "false");
    expect(actionsButton).not.toHaveAttribute("aria-controls");

    await userEvent.click(actionsButton);

    expect(actionsButton).toHaveAttribute("aria-expanded", "true");
    const panelId = actionsButton.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(String(panelId));
    expect(panel).toHaveTextContent("Select All");

    await userEvent.click(actionsButton);

    expect(actionsButton).toHaveAttribute("aria-expanded", "false");
    expect(actionsButton).not.toHaveAttribute("aria-controls");
  });

  it("closes the actions panel on a click outside it", async () => {
    renderWithSelection();
    const actionsButton = selectedActionsButton();
    await userEvent.click(actionsButton);
    const panelId = String(actionsButton.getAttribute("aria-controls"));
    expect(document.getElementById(panelId)).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(actionsButton).toHaveAttribute("aria-expanded", "false");
    expect(actionsButton).not.toHaveAttribute("aria-controls");
    expect(document.getElementById(panelId)).not.toBeInTheDocument();
  });

  it("offers only actions that do something", async () => {
    renderWithSelection();

    await userEvent.click(selectedActionsButton());
    const panel = document.getElementById(
      String(selectedActionsButton().getAttribute("aria-controls")),
    ) as HTMLElement;

    expect(
      Array.from(panel.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(["Select All"]);
  });

  it("offers no actions button when nothing is selected", () => {
    render(<Browse datasets={mockDatasets} title="Browse" subtitle="" />);

    expect(
      screen.queryByRole("button", { name: "Selected dataset actions" }),
    ).not.toBeInTheDocument();
  });
});

describe("Browse – filter vocabularies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultBrowseMocks();
  });

  it("loads the vocabularies once and reuses them each time the filters open", async () => {
    const user = userEvent.setup();
    const apiMock = {
      hasToken: true,
      getCollectionGrants: vi.fn().mockResolvedValue([]),
      getFieldsOfScience: vi.fn().mockResolvedValue([]),
      getLicenses: vi.fn().mockResolvedValue(["MIT"]),
    };
    mockUseApi.mockImplementation(() => ({ ...apiMock }));
    render(<Browse datasets={mockDatasets} title="Browse" subtitle="" />);

    for (let open = 0; open < 2; open += 1) {
      await user.click(screen.getByRole("button", { name: /^filter/i }));
      await screen.findByRole("button", { name: /apply/i });
      await user.click(screen.getByRole("button", { name: /cancel/i }));
    }

    expect(apiMock.getFieldsOfScience).toHaveBeenCalledTimes(1);
    expect(apiMock.getLicenses).toHaveBeenCalledTimes(1);
  });
});
