import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Composition proof for the dataset details route.
 *
 * The permission decoder has its own focused tests; this file exists because
 * the original defect survived every one of those layers. The mapper, the page
 * content and the sidebar sections each looked reasonable in isolation while
 * the composed page showed permissions the caller did not have and a public
 * badge nobody had established. So the page, `DatasetDetailsPageContent`,
 * `DatasetSidebar` and its permission/visibility sections are all real here.
 * Only the surrounding shell and the unrelated heavy children are replaced.
 *
 * Payload provenance: dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd`
 * `Model/Builder/DatasetBuilder.cs` with
 * `Common/Extensions.ReduceToAssignedPermissions`, which returns the requested
 * assigned permission names in lower case. Synthetic, not a live capture.
 */

const mockGetDatasetById = vi.fn();
const mockGetCurrentUserContextGrants = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ds-1" }),
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  usePathname: () => "/datasets/ds-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    hasToken: true,
    getDatasetById: mockGetDatasetById,
    getCurrentUserContextGrants: mockGetCurrentUserContextGrants,
    downloadDatasetFile: vi.fn(),
  }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: () => false,
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CreateCollectionModal", () => ({ default: () => null }));

vi.mock(
  "@/components/DatasetDetailsPage/DatasetRecommendationsSection/DatasetRecommendationsSection",
  () => ({ default: () => null }),
);
vi.mock("@/components/DatasetDetailsPage/FilePreview/FilePreview", () => ({
  default: () => null,
}));
vi.mock(
  "@/components/DatasetDetailsPage/DatasetFilesTree/DatasetFilesTree",
  () => ({ default: () => null }),
);

import DatasetDetailsPage from "./page";

const datasetPayload = (permissions: unknown) => ({
  id: "ds-1",
  name: "Sea surface temperature",
  description: "A dataset",
  ...(permissions === undefined ? {} : { permissions }),
});

const renderPage = async () => {
  render(<DatasetDetailsPage />);
  await waitFor(() =>
    expect(screen.getByText("Your permissions")).toBeInTheDocument(),
  );
};

/**
 * Scope assertions to one sidebar section: the page header carries its own
 * "Edit" button, and a chip is only meaningful where it is rendered.
 */
const section = (title: string) => {
  const heading = screen.getByRole("heading", { level: 3, name: title });
  return heading.closest("div")?.parentElement?.parentElement as HTMLElement;
};
const permissions = () => within(section("Your permissions"));

describe("dataset details page – caller permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
  });

  it("requests the permission name the Gateway actually declares", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
    await renderPage();

    const requestedFields = mockGetDatasetById.mock.calls[0][1] as string[];
    expect(requestedFields).toContain("permissions.downloadDatasetFile");
    expect(requestedFields).not.toContain("permissions.downloadDataset");
  });

  it("displays the permissions carried by a real permission array", async () => {
    mockGetDatasetById.mockResolvedValue(
      datasetPayload(["browsedataset", "editdataset", "downloaddatasetfile"]),
    );
    await renderPage();

    expect(permissions().getByText("Browse")).toBeInTheDocument();
    expect(permissions().getByText("Edit")).toBeInTheDocument();
    expect(permissions().getByText("Download")).toBeInTheDocument();
    expect(screen.queryByText("Viewer")).not.toBeInTheDocument();
  });

  it("does not present Browse as evidence that the dataset is public", async () => {
    mockGetDatasetById.mockResolvedValue(
      datasetPayload(["browsedataset", "editdataset"]),
    );
    await renderPage();

    expect(screen.getByText("Sharing not verified")).toBeInTheDocument();
    expect(screen.queryByText("Open Access")).not.toBeInTheDocument();
    expect(screen.queryByText("Restricted")).not.toBeInTheDocument();
  });

  it("shows no permissions rather than an invented role for an empty read", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload([]));
    await renderPage();

    expect(permissions().getByText("No permissions shown")).toBeInTheDocument();
    expect(screen.queryByText("Viewer")).not.toBeInTheDocument();
  });

  it("says permissions are unavailable when the payload carries no evidence", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(undefined));
    await renderPage();

    expect(
      permissions().getByText("Permissions unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Viewer")).not.toBeInTheDocument();
    expect(screen.getByText("Sharing not verified")).toBeInTheDocument();
  });

  it("says permissions are unavailable for a malformed permission payload", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload([null, 7]));
    await renderPage();

    expect(
      permissions().getByText("Permissions unavailable"),
    ).toBeInTheDocument();
  });

  it("still displays the legacy boolean object shape", async () => {
    mockGetDatasetById.mockResolvedValue(
      datasetPayload({
        browseDataset: true,
        editDataset: true,
        downloadDatasetFile: false,
      }),
    );
    await renderPage();

    expect(permissions().getByText("Browse")).toBeInTheDocument();
    expect(permissions().getByText("Edit")).toBeInTheDocument();
    expect(permissions().queryByText("Download")).not.toBeInTheDocument();
    expect(screen.getByText("Sharing not verified")).toBeInTheDocument();
  });
});

describe("dataset details page – existing management entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The role-based Manage fallback is unchanged in this batch: it remains the
   * only signal the page has, and replacing it needs the supported capability
   * contract that PM-05 has not established. This test pins the existing
   * behaviour so the display correction cannot silently remove the entry.
   */
  it("keeps the Manage entry that the self context-grant role provides", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
    mockGetCurrentUserContextGrants.mockResolvedValue([
      { targetType: 0, targetId: "ds-1", role: "dg_ds-manage" },
    ]);
    await renderPage();

    expect(
      await screen.findByRole("button", { name: /manage/i }),
    ).toBeInTheDocument();
  });

  it("does not offer management when no grant evidence supports it", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
    mockGetCurrentUserContextGrants.mockResolvedValue([
      { targetType: 0, targetId: "another-dataset", role: "dg_ds-manage" },
    ]);
    await renderPage();

    await waitFor(() =>
      expect(mockGetCurrentUserContextGrants).toHaveBeenCalled(),
    );
    expect(
      screen.queryByRole("button", { name: /manage/i }),
    ).not.toBeInTheDocument();
  });

  it("does not offer management when the grant lookup fails", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
    mockGetCurrentUserContextGrants.mockRejectedValue(new Error("denied"));
    await renderPage();

    await waitFor(() =>
      expect(mockGetCurrentUserContextGrants).toHaveBeenCalled(),
    );
    expect(
      screen.queryByRole("button", { name: /manage/i }),
    ).not.toBeInTheDocument();
  });
});
