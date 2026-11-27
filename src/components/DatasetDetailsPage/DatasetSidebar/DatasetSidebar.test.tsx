import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { DatasetPlus } from "@/data/dataset";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: () => false,
}));
vi.mock("@/components/CreateCollectionModal", () => ({
  default: ({ isVisible }: { isVisible: boolean }) =>
    isVisible ? <div role="dialog" aria-label="Add to collection" /> : null,
}));

import DatasetSidebar from "./DatasetSidebar";

const dataset: DatasetPlus = {
  id: "ds-1",
  title: "Algebra problems",
  category: "Math",
  description: "",
  size: "",
  lastUpdated: "",
  tags: [],
  license: "CC0 1.0",
  url: "https://example.org",
  language: "en",
  country: "GR",
  citation: "Doe (2020)",
  collections: [{ id: "c1", name: "Math", code: "math" }],
};

const renderSidebar = (permissions: string[] | undefined) =>
  render(
    <DatasetSidebar
      dataset={dataset}
      sharing="unknown"
      permissions={permissions}
      hasBrowsePermission
      hasEditPermission={false}
      hasDownloadPermission={false}
      hasManagePermission={permissions?.includes("Manage") ?? false}
    />,
  );

it("holds only Your permissions and Collections, in that order", () => {
  renderSidebar(["Browse"]);
  expect(
    screen.getAllByRole("heading").map((heading) => heading.textContent),
  ).toEqual(["Your permissions", "Collections"]);
  for (const moved of ["CC0 1.0", "Doe (2020)", "EN", "GR"])
    expect(screen.queryByText(moved)).not.toBeInTheDocument();
});

it("offers Manage only with the manage permission", () => {
  const { unmount } = renderSidebar(["Browse"]);
  expect(
    screen.queryByRole("button", { name: "Manage" }),
  ).not.toBeInTheDocument();
  unmount();
  renderSidebar(["Browse", "Manage"]);
  expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument();
});

it("opens Add to collection", () => {
  renderSidebar(["Browse"]);
  fireEvent.click(screen.getByRole("button", { name: "Add to collection" }));
  expect(
    screen.getByRole("dialog", { name: "Add to collection" }),
  ).toBeInTheDocument();
});
