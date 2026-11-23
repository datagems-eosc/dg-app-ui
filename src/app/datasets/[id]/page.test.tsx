import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVocabularyCache,
  loadFieldsOfScience,
} from "@/lib/vocabularyService";

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
const mockGetFieldsOfScience = vi.fn();
const mockGetCurrentUserContextGrants = vi.fn();
// The vocabulary is processed and cached once per module, so every test that
// loads it loads the same one.
const FIELDS_OF_SCIENCE = {
  hierarchy: [
    {
      ordinal: 1,
      code: "1",
      name: "NATURAL SCIENCES",
      children: [
        { ordinal: 1, code: "1.1", name: "MATHEMATICS" },
        {
          ordinal: 5,
          code: "1.5",
          name: "EARTH AND RELATED ENVIRONMENTAL SCIENCES",
        },
      ],
    },
  ],
};
const mockReadGlobalPermissions = vi.fn();
const mockPush = vi.fn();
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

let mockPrincipalId: string | null = "account-a";
let mockDatasetId = "ds-1";
let mockHasToken = true;
beforeEach(() => {
  mockPrincipalId = "account-a";
  mockDatasetId = "ds-1";
  mockHasToken = true;
  mockGetDatasetById.mockReset();
  mockGetFieldsOfScience.mockReset().mockResolvedValue(FIELDS_OF_SCIENCE);
  mockReadGlobalPermissions.mockReset().mockResolvedValue({
    evidence: { kind: "read", names: [], coverage: { kind: "exhaustive" } },
  });
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
      gateway: { readGlobalPermissions: mockReadGlobalPermissions },
      scope: mockPrincipalId
        ? {
            principalId: mockPrincipalId,
            gatewayOrigin: "https://gateway.example",
          }
        : null,
    },
    getDatasetById: mockGetDatasetById,
    getFieldsOfScience: mockGetFieldsOfScience,
    getCurrentUserContextGrants: mockGetCurrentUserContextGrants,
    downloadDatasetFile: vi.fn(),
  }),
}));

const mockLogError = vi.fn();
vi.mock("@/lib/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/logger")>()),
  logError: (...args: unknown[]) => mockLogError(...args),
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

describe("dataset details page fields of science", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearVocabularyCache();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
  });

  /** The Fields of Science section: its heading and chips. */
  const fields = () =>
    within(
      screen.getByRole("heading", { level: 3, name: "Fields of Science" })
        .parentElement as HTMLElement,
    );

  it("shows stored codes and names by readable name, once each", async () => {
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      fieldOfScience: [
        "1.1",
        "MATHEMATICS",
        "EARTH AND RELATED ENVIRONMENTAL SCIENCES",
        "dataset-test-A",
      ],
    });
    await renderPage();

    expect(fields().getAllByText("Mathematics")).toHaveLength(1);
    expect(
      fields().getByText("Earth and related environmental sciences"),
    ).toBeInTheDocument();
    expect(fields().getByText("dataset-test-A")).toBeInTheDocument();
    expect(fields().queryByText("1.1")).not.toBeInTheDocument();
    expect(fields().queryByText("MATHEMATICS")).not.toBeInTheDocument();
  });

  it("shows the dataset before the vocabulary arrives, then the names", async () => {
    const vocabulary = deferred<typeof FIELDS_OF_SCIENCE>();
    mockGetFieldsOfScience.mockReturnValue(vocabulary.promise);
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      fieldOfScience: ["1.1"],
    });
    await renderPage();

    expect(fields().getByText("1.1")).toBeInTheDocument();

    await act(async () => vocabulary.resolve(FIELDS_OF_SCIENCE));

    expect(fields().getByText("Mathematics")).toBeInTheDocument();
    expect(fields().queryByText("1.1")).not.toBeInTheDocument();
  });

  it("shows stored values as stored when the vocabulary cannot be loaded", async () => {
    mockGetFieldsOfScience.mockRejectedValue(new Error("503"));
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      fieldOfScience: ["1.1"],
    });
    await renderPage();

    expect(fields().getByText("1.1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Sea surface temperature",
      }),
    ).toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to fetch fields of science",
      expect.any(Error),
    );
  });

  it("uses a vocabulary loaded earlier in the session without asking again", async () => {
    await loadFieldsOfScience(async () => FIELDS_OF_SCIENCE);
    mockGetFieldsOfScience.mockRejectedValue(new Error("503"));
    mockGetDatasetById.mockResolvedValue({
      ...datasetPayload(["browsedataset"]),
      fieldOfScience: ["1.1"],
    });
    await renderPage();

    expect(fields().getByText("Mathematics")).toBeInTheDocument();
    expect(mockGetFieldsOfScience).not.toHaveBeenCalled();
  });
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

    expect(screen.queryByText("Sharing not verified")).not.toBeInTheDocument();
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
    expect(screen.queryByText("Sharing not verified")).not.toBeInTheDocument();
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
    expect(screen.queryByText("Sharing not verified")).not.toBeInTheDocument();
  });
});

describe("dataset details page – existing management entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["grant manager", ["addusertocontextgrantgroup"], [], true],
    ["revoke manager", ["removeuserfromcontextgrantgroup"], [], true],
    ["global administrator", [], ["AddUserToContextGrantGroup"], true],
    ["browser", ["browsedataset"], [], false],
    ["unknown", undefined, [], false],
    ["legacy label", ["managedataset"], [], false],
  ])(
    "uses actual permission evidence for %s",
    async (_name, granted, global, canManage) => {
      mockGetDatasetById.mockResolvedValue(datasetPayload(granted));
      mockReadGlobalPermissions.mockResolvedValue({
        evidence: {
          kind: "read",
          names: global,
          coverage: { kind: "exhaustive" },
        },
      });
      await renderPage();
      expect(Boolean(screen.queryByRole("button", { name: /^manage$/i }))).toBe(
        canManage,
      );
      expect(mockGetCurrentUserContextGrants).not.toHaveBeenCalled();
      expect(mockReadGlobalPermissions).toHaveBeenCalledTimes(1);
      expect(mockGetDatasetById).toHaveBeenCalledTimes(1);
    },
  );
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
    await screen.findAllByText("We couldn't load this dataset.");
    expect(mockGetDatasetById).toHaveBeenCalledTimes(2);
  });
});

it.each(["account", "dataset", "sign-out", "missing-principal"])(
  "rejects late dataset responses after %s changes",
  async (change) => {
    vi.clearAllMocks();
    mockGetCurrentUserContextGrants.mockResolvedValue([]);
    const pending = deferred<unknown>();
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

it("requests supported metadata and does not fabricate an updated date", async () => {
  vi.clearAllMocks();
  mockGetCurrentUserContextGrants.mockResolvedValue([]);
  mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
  await renderPage();
  const fields = mockGetDatasetById.mock.calls[0][1];
  expect(fields).not.toContain("mimeType");
  expect(fields).not.toContain("size");
  expect(fields).not.toContain("lastUpdated");
  expect(fields).not.toContain("collections.datasetCount");
  expect(fields).toEqual(
    expect.arrayContaining(["profileRaw", "datePublished"]),
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

it.each([
  [404, "Dataset not found."],
  [403, "You don't have access to this dataset."],
  [500, "We couldn't load this dataset."],
])("distinguishes page HTTP %s once", async (status, message) => {
  mockGetDatasetById.mockRejectedValueOnce(
    Object.assign(new Error("private error body"), { status }),
  );
  render(<DatasetDetailsPage />);
  expect(
    await screen.findByRole("heading", { name: String(message) }),
  ).toBeInTheDocument();
  expect(screen.getAllByText(String(message))).toHaveLength(1);
  expect(screen.queryByText("private error body")).not.toBeInTheDocument();
});
it("offers retry only for a failed request and recovers the dataset", async () => {
  mockGetCurrentUserContextGrants.mockResolvedValue([]);
  mockGetDatasetById
    .mockRejectedValueOnce(Object.assign(new Error("offline"), { status: 500 }))
    .mockResolvedValueOnce(datasetPayload(["browsedataset"]));
  render(<DatasetDetailsPage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Try again" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Sea surface temperature" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Try again" }),
  ).not.toBeInTheDocument();
});

it("requests browse, search, download and management in the single dataset read", async () => {
  mockGetDatasetById.mockResolvedValue(
    datasetPayload(["browsedataset", "searchdataset", "downloaddatasetfile"]),
  );
  await renderPage();
  expect(mockGetDatasetById).toHaveBeenCalledTimes(1);
  expect(mockGetDatasetById.mock.calls[0][1]).toEqual(
    expect.arrayContaining([
      "permissions.browseDataset",
      "permissions.searchDataset",
      "permissions.downloadDatasetFile",
      "permissions.addUserToContextGrantGroup",
      "permissions.removeUserFromContextGrantGroup",
    ]),
  );
  expect(permissions().getByText("Browse")).toBeInTheDocument();
  expect(permissions().getByText("Search")).toBeInTheDocument();
  expect(permissions().getByText("Download")).toBeInTheDocument();
  expect(mockReadGlobalPermissions).toHaveBeenCalledTimes(1);
  expect(mockGetCurrentUserContextGrants).not.toHaveBeenCalled();
});

it.each([false, true])(
  "keeps metadata and uses context evidence when global read fails (manager=%s)",
  async (manager) => {
    mockGetDatasetById.mockResolvedValue(
      datasetPayload(
        manager ? ["addusertocontextgrantgroup"] : ["browsedataset"],
      ),
    );
    mockReadGlobalPermissions.mockRejectedValue(new Error("offline"));
    await renderPage();
    expect(Boolean(screen.queryByRole("button", { name: /^manage$/i }))).toBe(
      manager,
    );
    expect(mockGetDatasetById).toHaveBeenCalledTimes(1);
  },
);

it.each([{ kind: "failed" }, { kind: "not-read" }])(
  "hides management without positive evidence when global evidence is %j",
  async (evidence) => {
    mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
    mockReadGlobalPermissions.mockResolvedValue({ evidence });
    await renderPage();
    expect(
      screen.queryByRole("button", { name: /^manage$/i }),
    ).not.toBeInTheDocument();
  },
);

it("ignores a late global manager response after the account changes", async () => {
  const oldGlobal = deferred<unknown>();
  mockGetDatasetById.mockResolvedValue(datasetPayload(["browsedataset"]));
  mockReadGlobalPermissions.mockReturnValueOnce(oldGlobal.promise);
  const { rerender } = render(<DatasetDetailsPage />);
  await waitFor(() =>
    expect(mockReadGlobalPermissions).toHaveBeenCalledTimes(1),
  );
  const oldSignal = mockReadGlobalPermissions.mock.calls[0][0] as AbortSignal;
  mockPrincipalId = "account-b";
  rerender(<DatasetDetailsPage />);
  await screen.findByText("Your permissions");
  expect(oldSignal.aborted).toBe(true);
  await act(async () =>
    oldGlobal.resolve({
      evidence: {
        kind: "read",
        names: ["AddUserToContextGrantGroup"],
        coverage: { kind: "exhaustive" },
      },
    }),
  );
  expect(
    screen.queryByRole("button", { name: /^manage$/i }),
  ).not.toBeInTheDocument();
});
