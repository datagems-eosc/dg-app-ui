import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseFeatureFlag = vi.fn();

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

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
  default: () => null,
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

describe("DatasetDetailsPageContent – generalChat flag (Hide general chat)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Select and 0 Selected buttons when flag is OFF (false)", () => {
    mockUseFeatureFlag.mockReturnValue(false);
    render(<DatasetDetailsPageContent dataset={mockDataset} />);
    expect(
      screen.getByRole("button", { name: /^select$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /selected/i }),
    ).toBeInTheDocument();
  });

  it("hides Select and 0 Selected buttons when flag is ON (true)", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(<DatasetDetailsPageContent dataset={mockDataset} />);
    expect(screen.queryByRole("button", { name: /^select$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /0 selected/i })).toBeNull();
  });

  it("always shows Edit button regardless of flag", () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(<DatasetDetailsPageContent dataset={mockDataset} />);
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });
});
