import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RolesPermissionsSection from "./RolesPermissionsSection";

const mockUseApi = vi.fn();
const mockPush = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("RolesPermissionsSection", () => {
  it("renders rows from context grants", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      getCurrentUserContextGrants: vi.fn().mockResolvedValue([
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-1",
          role: "edit",
        },
        {
          principalId: null,
          principalType: 0,
          targetType: 1,
          targetId: "collection-1",
          role: "browse",
        },
      ]),
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      queryDatasets: vi.fn().mockResolvedValue({
        items: [{ id: "dataset-1", name: "Dataset One" }],
      }),
      queryCollections: vi.fn().mockResolvedValue({
        items: [{ id: "collection-1", name: "Collection One" }],
      }),
    });
    render(<RolesPermissionsSection />);

    expect(screen.getByText("User Access")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Show permissions for")).toBeInTheDocument();
    expect(screen.getByText("My groups")).toBeInTheDocument();
    expect(screen.getByText("Dataset name")).toBeInTheDocument();
    expect(screen.getByText("Groups Added")).toBeInTheDocument();
    expect(screen.getAllByText("Permissions").length).toBeGreaterThan(0);
    expect(await screen.findByText("Dataset One")).toBeInTheDocument();
    expect(screen.queryByText("Collection One")).toBeNull();
  });

  it("opens dataset permissions modal when row is clicked", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      getCurrentUserContextGrants: vi.fn().mockResolvedValue([
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-1",
          role: "edit",
        },
      ]),
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      queryDatasets: vi.fn().mockResolvedValue({
        items: [{ id: "dataset-1", name: "Dataset One" }],
      }),
      queryCollections: vi.fn().mockResolvedValue({ items: [] }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({}),
      assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(<RolesPermissionsSection />);

    const editChip = await screen.findByText("Edit");
    editChip.click();

    expect(
      await screen.findByRole("dialog", { name: "Dataset One" }),
    ).toBeInTheDocument();
  });

  it("sorts by asset name when header is clicked", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      getCurrentUserContextGrants: vi.fn().mockResolvedValue([
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-b",
          role: "browse",
        },
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-a",
          role: "browse",
        },
      ]),
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      queryDatasets: vi.fn().mockResolvedValue({
        items: [
          { id: "dataset-b", name: "Dataset B", datePublished: "2024-01-02" },
          { id: "dataset-a", name: "Dataset A", datePublished: "2024-01-01" },
        ],
      }),
      queryCollections: vi.fn().mockResolvedValue({ items: [] }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({}),
      assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(<RolesPermissionsSection />);

    const datasetB = await screen.findByText("Dataset B");
    const datasetA = await screen.findByText("Dataset A");
    expect(datasetB.compareDocumentPosition(datasetA)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const headers = screen.getAllByRole("button", { name: "Dataset name" });
    const header = headers[0];
    header.click();

    await waitFor(() => {
      expect(screen.getAllByText("Dataset A").length).toBeGreaterThan(0);
    });
    const sortedA = screen.getAllByText("Dataset A")[0];
    const sortedB = screen.getAllByText("Dataset B")[0];
    expect(sortedA.compareDocumentPosition(sortedB)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("shows the dataset id under the dataset name (DG-241)", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      getCurrentUserContextGrants: vi.fn().mockResolvedValue([
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-1",
          role: "edit",
        },
      ]),
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      queryDatasets: vi.fn().mockResolvedValue({
        items: [{ id: "dataset-1", name: "Dataset One" }],
      }),
      queryCollections: vi.fn().mockResolvedValue({ items: [] }),
    });

    render(<RolesPermissionsSection />);

    expect(await screen.findByText("Dataset One")).toBeInTheDocument();
    expect(screen.getByText("dataset-1")).toBeInTheDocument();
  });

  it("marks grants whose dataset no longer resolves and reports them next to the result count (DG-240)", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      getCurrentUserContextGrants: vi.fn().mockResolvedValue([
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-1",
          role: "edit",
        },
        {
          principalId: "group-1",
          principalType: 1,
          targetType: 0,
          targetId: "dataset-deleted",
          role: "browse",
        },
      ]),
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      // The API only knows dataset-1; dataset-deleted is an orphaned grant.
      queryDatasets: vi.fn().mockResolvedValue({
        items: [{ id: "dataset-1", name: "Dataset One" }],
      }),
      queryCollections: vi.fn().mockResolvedValue({ items: [] }),
    });

    render(<RolesPermissionsSection />);

    expect(await screen.findByText("Unknown dataset")).toBeInTheDocument();
    expect(screen.getByText("dataset-deleted")).toBeInTheDocument();
    expect(
      screen.getByText(/1 reference datasets that no longer exist/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 results/)).toBeInTheDocument();
  });
});
