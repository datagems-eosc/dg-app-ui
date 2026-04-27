import { fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DatasetPermissionsSection from "./DatasetPermissionsSection";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const defaultProps = {
  datasetId: "ds-123",
  datasetName: "Test Dataset",
  hasBrowsePermission: true,
  hasEditPermission: false,
  hasDownloadPermission: false,
  hasManagePermission: false,
  permissions: ["Browse"],
};

describe("DatasetPermissionsSection", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders Your Permissions title and permission chips", () => {
    const { container } = render(
      <DatasetPermissionsSection {...defaultProps} />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Your Permissions")).toBeInTheDocument();
    expect(within(section).getByText("Browse")).toBeInTheDocument();
  });

  it("displays Browse chip when user has only browse permission", () => {
    const { container } = render(
      <DatasetPermissionsSection {...defaultProps} />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Browse")).toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: /manage/i }),
    ).not.toBeInTheDocument();
  });

  it("displays Browse and Edit chips when user has edit permission", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        hasEditPermission
        permissions={["Browse", "Edit"]}
      />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Browse")).toBeInTheDocument();
    expect(within(section).getByText("Edit")).toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: /manage/i }),
    ).not.toBeInTheDocument();
  });

  it("displays Manage button and permission chips when user has manage permission", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        hasManagePermission
        permissions={["Browse", "Edit", "Manage"]}
      />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Browse")).toBeInTheDocument();
    expect(within(section).getByText("Edit")).toBeInTheDocument();
    expect(
      within(section).getAllByText("Manage").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(section).getByRole("button", { name: /manage/i }),
    ).toBeInTheDocument();
  });

  it("navigates to settings roles with datasetId when Manage is clicked", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        hasManagePermission
        datasetId="ds-456"
        permissions={["Manage"]}
      />,
    );
    const section = container.firstChild as HTMLElement;

    fireEvent.click(within(section).getByRole("button", { name: /manage/i }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0];
    expect(pushedUrl).toContain("settings");
    expect(pushedUrl).toContain("tab=roles");
    expect(pushedUrl).toContain("datasetId=ds-456");
  });

  it("navigates to settings roles without datasetId when datasetId is empty", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        datasetId=""
        hasManagePermission
        permissions={["Manage"]}
      />,
    );
    const section = container.firstChild as HTMLElement;

    fireEvent.click(within(section).getByRole("button", { name: /manage/i }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0];
    expect(pushedUrl).toContain("settings");
    expect(pushedUrl).toContain("tab=roles");
    expect(pushedUrl).not.toContain("datasetId=");
  });

  it("displays Viewer chip when permissions array is empty", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        permissions={[]}
        hasEditPermission={false}
        hasDownloadPermission={false}
        hasManagePermission={false}
      />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Viewer")).toBeInTheDocument();
  });
});
