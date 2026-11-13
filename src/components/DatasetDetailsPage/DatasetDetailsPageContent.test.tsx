import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sidebarProps = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/datasets/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({ downloadDatasetFile: vi.fn() }),
}));

vi.mock("./DatasetDescriptionSection/DatasetDescriptionSection", () => ({
  default: () => null,
}));
vi.mock("./DatasetFilesTree/DatasetFilesTree", () => ({
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
