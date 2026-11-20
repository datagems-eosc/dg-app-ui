import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as datasetProfile from "@/lib/datasetProfile";

const sidebarProps = vi.fn();
const download = vi.hoisted(() => vi.fn());
const getSessionPrincipalId = vi.hoisted(() => vi.fn<() => string | null>());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/datasets/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    downloadDatasetFile: download,
    sessionPrincipalId: getSessionPrincipalId(),
    datasetPermissions: { scope: null },
  }),
}));

beforeEach(() => {
  getSessionPrincipalId.mockReturnValue("user");
});

vi.mock("./DatasetDescriptionSection/DatasetDescriptionSection", () => ({
  default: () => null,
}));
vi.mock("./DatasetHeader/DatasetHeader", () => ({
  default: () => null,
}));
vi.mock("./DatasetMetadataBar/DatasetMetadataBar", () => ({
  default: () => null,
}));
vi.mock(
  "./DatasetRecommendationsSection/DatasetRecommendationsSection",
  () => ({
    default: () => null,
    DatasetRecommendationsSection: () => null,
  }),
);
vi.mock("./DatasetSidebar/DatasetSidebar", () => ({
  default: (props: Record<string, unknown>) => {
    sidebarProps(props);
    return null;
  },
}));
vi.mock("./DatasetTagsSection/DatasetTagsSection", () => ({
  default: () => null,
}));
vi.mock("./FilePreview/FilePreview", () => ({
  default: () => null,
}));

import type { DatasetPlus } from "@/data/dataset";
import DatasetDetailsPageContent from "./DatasetDetailsPageContent";

const mockDataset: DatasetPlus = {
  id: "ds-1",
  title: "Test Dataset",
  description: "Test",
  license: "MIT",
  size: "1 MB",
  datePublished: "2024-01-01",
  category: "Math",
  access: "Open Access",
  lastUpdated: "2024-01-01",
  tags: [],
  permissions: ["Browse"],
  profileRaw: null,
} as unknown as DatasetPlus;

describe("DatasetDetailsPageContent selection controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides dead selection controls", () => {
    render(<DatasetDetailsPageContent dataset={mockDataset} />);
    expect(
      screen.queryByRole("button", { name: /^select$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /selected/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the unwired Edit control", () => {
    render(<DatasetDetailsPageContent dataset={mockDataset} />);
    expect(
      screen.queryByRole("button", { name: /^edit$/i }),
    ).not.toBeInTheDocument();
  });
});

it("distinguishes an unreadable file profile from a dataset with no files", () => {
  const { rerender } = render(
    <DatasetDetailsPageContent dataset={mockDataset} />,
  );
  expect(
    screen.getByText("No files are available to preview for this dataset."),
  ).toBeInTheDocument();
  rerender(
    <DatasetDetailsPageContent
      dataset={{ ...mockDataset, profileRaw: "invalid JSON" }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "The file profile could not be loaded.",
  );
});

describe("DatasetDetailsPageContent – publication and permission forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const lastSidebarProps = () =>
    sidebarProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;

  it("forwards an explicit unknown sharing state instead of coercing it", () => {
    render(
      <DatasetDetailsPageContent
        dataset={
          {
            ...mockDataset,
            access: undefined,
            sharing: "unknown",
          } as DatasetPlus
        }
      />,
    );

    expect(lastSidebarProps().sharing).toBe("unknown");
  });

  it("treats a dataset with no publication claim as unknown, not Restricted", () => {
    render(
      <DatasetDetailsPageContent
        dataset={{ ...mockDataset, access: undefined } as DatasetPlus}
      />,
    );

    expect(lastSidebarProps().sharing).toBe("unknown");
  });

  it("still honours the legacy binary access label", () => {
    render(<DatasetDetailsPageContent dataset={mockDataset} />);
    expect(lastSidebarProps().sharing).toBe("public");

    render(
      <DatasetDetailsPageContent
        dataset={{ ...mockDataset, access: "Restricted" } as DatasetPlus}
      />,
    );
    expect(lastSidebarProps().sharing).toBe("restricted");
  });

  it("keeps unreadable permission evidence distinct from an empty read", () => {
    render(
      <DatasetDetailsPageContent
        dataset={{ ...mockDataset, permissions: undefined } as DatasetPlus}
      />,
    );
    expect(lastSidebarProps().permissions).toBeUndefined();
    expect(lastSidebarProps().hasBrowsePermission).toBe(false);

    render(
      <DatasetDetailsPageContent
        dataset={{ ...mockDataset, permissions: [] } as DatasetPlus}
      />,
    );
    expect(lastSidebarProps().permissions).toEqual([]);
  });

  it("forwards the caller capabilities it was given", () => {
    render(
      <DatasetDetailsPageContent
        dataset={
          { ...mockDataset, permissions: ["Browse", "Download"] } as DatasetPlus
        }
      />,
    );

    const props = lastSidebarProps();
    expect(props.permissions).toEqual(["Browse", "Download"]);
    expect(props.hasDownloadPermission).toBe(true);
    expect(props.hasManagePermission).toBe(false);
  });
});
it("shows one no-files state instead of an empty preview", () => {
  render(<DatasetDetailsPageContent dataset={mockDataset} />);
  expect(
    screen.getByText("No files are available to preview for this dataset."),
  ).toBeInTheDocument();
});

const downloadableDataset = {
  ...mockDataset,
  permissions: ["Download"],
  profileRaw: {
    nodes: [
      {
        id: "original-file",
        labels: ["cr:FileObject"],
        properties: {
          name: "original.hash.bin",
          encodingFormat: "application/octet-stream",
        },
      },
    ],
    edges: [],
  },
} as DatasetPlus;

it("offers a real download even when the selected file has no preview", async () => {
  download.mockRejectedValueOnce(new Error("offline"));
  render(<DatasetDetailsPageContent dataset={downloadableDataset} />);
  fireEvent.click(screen.getByRole("button", { name: "Download file" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Download failed. Try again.",
    ),
  );
  expect(download).toHaveBeenCalledWith(
    "ds-1",
    "original-file",
    expect.any(AbortSignal),
  );
  expect(screen.getByText("No preview for this file.")).toBeInTheDocument();
});

it("downloads the selected FileObject from a nested folder", async () => {
  const flatTree = datasetProfile.buildFileTree(downloadableDataset.profileRaw);
  const tree = vi.spyOn(datasetProfile, "buildFileTree").mockReturnValue([
    ...flatTree,
    {
      id: "outer",
      name: "Outer folder",
      kind: "folder",
      children: [
        {
          id: "inner",
          name: "Inner folder",
          kind: "folder",
          children: [{ id: "nested-file", name: "nested.bin", kind: "file" }],
        },
      ],
    },
  ]);
  try {
    download.mockRejectedValueOnce(new Error("offline"));
    render(<DatasetDetailsPageContent dataset={downloadableDataset} />);
    fireEvent.click(screen.getByText("Outer folder"));
    fireEvent.click(screen.getByText("Inner folder"));
    fireEvent.click(screen.getByText("nested.bin"));
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Download failed. Try again.",
    );
    expect(download).toHaveBeenLastCalledWith(
      "ds-1",
      "nested-file",
      expect.any(AbortSignal),
    );
  } finally {
    tree.mockRestore();
  }
});

it("hides Download when the selected file disappears even if another file remains", () => {
  const remainingDataset = {
    ...downloadableDataset,
    profileRaw: {
      nodes: [
        {
          id: "remaining-file",
          labels: ["cr:FileObject"],
          properties: { name: "remaining.bin" },
        },
      ],
      edges: [],
    },
  } as DatasetPlus;
  const { rerender } = render(
    <DatasetDetailsPageContent dataset={downloadableDataset} />,
  );
  fireEvent.click(screen.getByText("original.hash.bin"));
  expect(screen.getByRole("button", { name: "Download file" })).toBeEnabled();
  rerender(<DatasetDetailsPageContent dataset={remainingDataset} />);
  expect(screen.getByText("remaining.bin")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Download file" }),
  ).not.toBeInTheDocument();
});

it.each([[undefined], [[]], [["Browse"]], [["Manage"]]])(
  "hides Download without a positive dataset permission (%j)",
  (permissions) => {
    render(
      <DatasetDetailsPageContent
        dataset={{ ...downloadableDataset, permissions } as DatasetPlus}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /download/i }),
    ).not.toBeInTheDocument();
  },
);

it("hides Download without a session principal even with dataset permission", () => {
  getSessionPrincipalId.mockReturnValue(null);
  render(<DatasetDetailsPageContent dataset={downloadableDataset} />);
  expect(
    screen.queryByRole("button", { name: "Download file" }),
  ).not.toBeInTheDocument();
});

it("does not use a RecordSet as a downloadable FileObject", () => {
  render(
    <DatasetDetailsPageContent
      dataset={
        {
          ...downloadableDataset,
          profileRaw: {
            nodes: [
              {
                id: "table",
                labels: ["cr:RecordSet"],
                properties: { name: "table" },
              },
            ],
            edges: [],
          },
        } as DatasetPlus
      }
    />,
  );
  expect(
    screen.queryByRole("button", { name: /download/i }),
  ).not.toBeInTheDocument();
});

it("disables Download and announces its pending state", async () => {
  download.mockReturnValue(new Promise(() => {}));
  render(<DatasetDetailsPageContent dataset={downloadableDataset} />);
  fireEvent.click(screen.getByRole("button", { name: "Download file" }));
  expect(
    screen.getByRole("button", { name: "Downloading file" }),
  ).toBeDisabled();
  expect(screen.getByText("Downloading...")).toBeInTheDocument();
});
