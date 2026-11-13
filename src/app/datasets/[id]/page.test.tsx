import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
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
let mockPrincipalId: string | null = "account-a";
let mockDatasetId = "ds-1";
let mockHasToken = true;
beforeEach(() => {
  mockPrincipalId = "account-a";
  mockDatasetId = "ds-1";
  mockHasToken = true;
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: mockDatasetId }),
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  usePathname: () => "/datasets/ds-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    hasToken: mockHasToken,
    datasetPermissions: {
      scope: mockPrincipalId
        ? {
            principalId: mockPrincipalId,
            gatewayOrigin: "https://gateway.example",
          }
        : null,
    },
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

describe("dataset details page headline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
  });

  it("requests the headline field from the Gateway", async () => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
    await renderPage();
    expect(mockGetDatasetById).toHaveBeenCalledWith(
      "ds-1",
      expect.arrayContaining(["headline"]),
    );
  });
  it("shows the returned headline separately from the full description", async () => {
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      headline: "Short ocean measurements summary",
    });
    await renderPage();
    expect(
      screen.getByText("Short ocean measurements summary"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("A dataset")).toHaveLength(1);
  });

  it.each([
    "Sea surface temperature",
    "A dataset",
    "  Sea surface temperature  ",
    "  A dataset  ",
  ])(
    "hides a headline duplicating the name or description: %s",
    async (headline) => {
      mockGetDatasetById.mockResolvedValue({
        ...datasetPayload(["browsedataset"]),
        headline,
      });
      await renderPage();
      expect(screen.queryByText("Sea surface temperature")).toBe(
        screen.getByRole("heading", {
          level: 1,
          name: "Sea surface temperature",
        }),
      );
      expect(screen.getAllByText("A dataset")).toHaveLength(1);
    },
  );

  it.each([undefined, null, "", "  ", 42, { text: "Unexpected value" }])(
    "does not invent a headline for missing or invalid data: %j",
    async (headline) => {
      mockGetDatasetById.mockResolvedValue({
        ...datasetPayload(["browsedataset"]),
        headline,
      });
      await renderPage();
      expect(screen.queryByText("Sea surface temperature")).toBe(
        screen.getByRole("heading", {
          level: 1,
          name: "Sea surface temperature",
        }),
      );
      expect(screen.getAllByText("A dataset")).toHaveLength(1);
    },
  );

  it.each([undefined, null, "", "  "])(
    "keeps a distinct headline when the full description is absent: %j",
    async (description) => {
      mockGetDatasetById.mockResolvedValue({
        ...datasetPayload(["browsedataset"]),
        name: "  Sea surface temperature  ",
        headline: "  Short ocean measurements summary  ",
        description,
      });
      await renderPage();
      expect(
        screen.getByText("Short ocean measurements summary"),
      ).toBeInTheDocument();
      expect(screen.getAllByText("No description available.")).toHaveLength(1);
    },
  );
});

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

describe("dataset details page citation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
  });

  it("requests citeAs and displays and copies the returned citation", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    const citeAs = "Marine Institute (2026). Sea surface temperature.";
    mockGetDatasetById.mockImplementation(async (_id, fields: string[]) => ({
      ...datasetPayload(["browsedataset"]),
      ...(fields.includes("citeAs") ? { citeAs } : {}),
    }));

    await renderPage();

    expect(mockGetDatasetById).toHaveBeenCalledWith(
      "ds-1",
      expect.arrayContaining(["citeAs"]),
    );
    expect(mockGetDatasetById.mock.calls[0][1]).not.toContain("citation");
    expect(screen.getByRole("heading", { name: "Citation" })).toBeVisible();
    expect(screen.getByText(citeAs)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Copy$/ }));
    expect(writeText).toHaveBeenCalledWith(citeAs);
  });

  it.each([
    ["missing", {}],
    ["null", { citeAs: null }],
    ["empty", { citeAs: "" }],
    ["legacy only", { citation: "Unsupported citation" }],
  ])("omits the Citation section for a %s citeAs", async (_name, metadata) => {
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      ...metadata,
    });
    await renderPage();
    expect(
      screen.queryByRole("heading", { name: "Citation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Copy$/ }),
    ).not.toBeInTheDocument();
  });

  it("uses citeAs when an unsupported citation field is also returned", async () => {
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      citeAs: "Gateway citation",
      citation: "Unsupported citation",
    });
    await renderPage();
    expect(screen.getByText("Gateway citation")).toBeVisible();
    expect(screen.queryByText("Unsupported citation")).not.toBeInTheDocument();
  });
});

describe("profile metadata composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
  });

  it("keeps valid PDF and user metadata when graph siblings are malformed", async () => {
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      profileRaw: {
        nodes: [
          null,
          false,
          [],
          { id: 12, labels: "cr:FileObject", properties: [] },
          {
            id: "pdf",
            labels: ["cr:FileObject"],
            properties: {
              encodingFormat: "application/pdf",
              contentSize: "140048 B",
            },
          },
        ],
        edges: [null, false, { from: {}, to: [], labels: "field" }],
      },
    });
    await renderPage();
    expect(screen.getByText("PDF", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("A dataset")).toBeInTheDocument();
  });
});

describe("dataset request owner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
  });

  it("does not retain A's dataset when B is forbidden on the same dataset", async () => {
    mockGetDatasetById
      .mockResolvedValueOnce({
        ...datasetPayload(["browsedataset"]),
        name: "Account A data",
      })
      .mockRejectedValueOnce(new Error("Forbidden"));
    const { rerender } = render(<DatasetDetailsPage />);
    await screen.findByRole("heading", { name: "Account A data" });
    mockPrincipalId = "account-b";
    rerender(<DatasetDetailsPage />);
    expect(
      screen.queryByRole("heading", { name: "Account A data" }),
    ).not.toBeInTheDocument();
    await screen.findAllByText("Failed to load dataset");
    expect(mockGetDatasetById).toHaveBeenCalledTimes(2);
  });
});

it.each(["account", "dataset", "sign-out", "missing-principal"])(
  "rejects late dataset responses after %s changes",
  async (change) => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
    const pending = Promise.withResolvers<unknown>();
    mockGetDatasetById
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({
        ...datasetPayload(["browsedataset"]),
        name: "Current dataset",
      });
    const { rerender } = render(<DatasetDetailsPage />);
    await waitFor(() => expect(mockGetDatasetById).toHaveBeenCalledTimes(1));
    if (change === "account") mockPrincipalId = "account-b";
    if (change === "dataset") mockDatasetId = "ds-2";
    if (change === "sign-out") mockHasToken = false;
    if (change === "missing-principal") mockPrincipalId = null;
    rerender(<DatasetDetailsPage />);
    if (change === "account" || change === "dataset")
      await screen.findByRole("heading", { name: "Current dataset" });
    else
      expect(
        screen.getByRole("heading", { name: "Authentication required" }),
      ).toBeInTheDocument();
    await act(async () =>
      pending.resolve({
        ...datasetPayload(["browsedataset"]),
        name: "Stale dataset",
      }),
    );
    expect(
      screen.queryByRole("heading", { name: "Stale dataset" }),
    ).not.toBeInTheDocument();
  },
);

it("rejects late context-grant results after the account changes", async () => {
  vi.clearAllMocks();
  const pending = Promise.withResolvers<unknown>();
  mockGetDatasetById.mockResolvedValue({
    ...datasetPayload(["browsedataset"]),
    name: "Current dataset",
  });
  mockGetCurrentUserContextGrants
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce([]);
  const { rerender } = render(<DatasetDetailsPage />);
  await waitFor(() =>
    expect(mockGetCurrentUserContextGrants).toHaveBeenCalledTimes(1),
  );
  mockPrincipalId = "account-b";
  rerender(<DatasetDetailsPage />);
  await screen.findByRole("heading", { name: "Current dataset" });
  await act(async () =>
    pending.resolve([
      { targetType: 0, targetId: "ds-1", role: "dg_ds-manage" },
    ]),
  );
  expect(permissions().queryByText("Manage")).not.toBeInTheDocument();
});

it("requests supported metadata and does not fabricate an updated date", async () => {
  vi.clearAllMocks();
  mockGetCurrentUserContextGrants.mockResolvedValue([]);
  mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
  await renderPage();
  const fields = mockGetDatasetById.mock.calls[0][1];
  expect(fields).not.toContain("mimeType");
  expect(fields).not.toContain("size");
  expect(fields).toEqual(
    expect.arrayContaining(["profileRaw", "datePublished", "lastUpdated"]),
  );
  expect(screen.queryByText("2024-01-01")).not.toBeInTheDocument();
  expect(screen.queryByText("Last updated")).not.toBeInTheDocument();
});

it("does not flash a previous read before effects after signing back in", async () => {
  vi.clearAllMocks();
  mockGetCurrentUserContextGrants.mockResolvedValue([]);
  mockGetDatasetById
    .mockResolvedValueOnce({
      ...datasetPayload(["browsedataset"]),
      name: "Previous authenticated read",
    })
    .mockReturnValueOnce(new Promise(() => {}));
  const committed: string[] = [];
  function ObserveCommittedPage() {
    useLayoutEffect(() => {
      committed.push(document.body.textContent ?? "");
    });
    return <DatasetDetailsPage />;
  }
  const { rerender } = render(<ObserveCommittedPage />);
  await screen.findByRole("heading", { name: "Previous authenticated read" });
  mockHasToken = false;
  rerender(<ObserveCommittedPage />);
  mockHasToken = true;
  rerender(<ObserveCommittedPage />);
  expect(committed.at(-1)).not.toContain("Previous authenticated read");
});

it("shows profiler output below author metadata without replacing either source", async () => {
  vi.clearAllMocks();
  mockGetCurrentUserContextGrants.mockResolvedValue([]);
  mockGetDatasetById.mockResolvedValue({
    ...datasetPayload(["browsedataset"]),
    keywords: ["Author keyword"],
    profileRaw: {
      nodes: [
        {
          id: "record",
          labels: ["cr:RecordSet"],
          properties: {
            summary: "Generated nursing overview",
            keywords: ["Generated keyword"],
          },
        },
      ],
    },
  });
  await renderPage();
  expect(
    screen.getByRole("heading", { name: "Profiling summary" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Generated nursing overview")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Profiling keywords" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Generated keyword")).toBeInTheDocument();
  expect(screen.getByText("A dataset")).toBeInTheDocument();
  expect(screen.getByText("Author keyword")).toBeInTheDocument();
});
