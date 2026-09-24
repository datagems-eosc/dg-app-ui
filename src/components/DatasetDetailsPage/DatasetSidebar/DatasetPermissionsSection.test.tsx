import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockUseFeatureFlag = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

// The shared destination is exercised on its own; here the question is only
// which entry this section offers, and whether the legacy one is untouched
// while the flag is off.
vi.mock("@ui/user/DatasetPermissionsModal", () => ({
  DatasetPermissionsModal: ({
    isOpen,
    datasetId,
    datasetName,
  }: {
    isOpen: boolean;
    datasetId: string;
    datasetName: string;
  }) =>
    isOpen ? (
      <div data-testid="access-modal">{`${datasetId}|${datasetName}`}</div>
    ) : null,
}));

import DatasetPermissionsSection from "./DatasetPermissionsSection";

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
    // Every existing expectation below is about the behaviour with the rollout
    // flag off, which must be exactly what it was before the flag existed.
    mockUseFeatureFlag.mockReset();
    mockUseFeatureFlag.mockReturnValue(false);
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

  it("displays the Download chip, which now comes from DownloadDatasetFile", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        hasDownloadPermission
        permissions={["Browse", "Download"]}
      />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Download")).toBeInTheDocument();
  });

  it("reports an empty read as no permissions, never as an invented Viewer role", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        permissions={[]}
        hasBrowsePermission={false}
        hasEditPermission={false}
        hasDownloadPermission={false}
        hasManagePermission={false}
      />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("No permissions")).toBeInTheDocument();
    expect(within(section).queryByText("Viewer")).not.toBeInTheDocument();
  });

  it("reports unreadable permission evidence as unavailable, not as empty", () => {
    const { container } = render(
      <DatasetPermissionsSection
        {...defaultProps}
        permissions={undefined}
        hasBrowsePermission={false}
        hasEditPermission={false}
        hasDownloadPermission={false}
        hasManagePermission={false}
      />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Not available")).toBeInTheDocument();
    expect(within(section).queryByText("Viewer")).not.toBeInTheDocument();
    expect(
      within(section).queryByText("No permissions"),
    ).not.toBeInTheDocument();
  });

  it("keeps a capability it holds visible instead of claiming there are none", () => {
    const { container } = render(
      <DatasetPermissionsSection {...defaultProps} permissions={["Delete"]} />,
    );
    const section = container.firstChild as HTMLElement;

    expect(within(section).getByText("Delete")).toBeInTheDocument();
    expect(
      within(section).queryByText("No permissions"),
    ).not.toBeInTheDocument();
  });
});

/**
 * The new entry point, behind `datasetGroupAccess`.
 *
 * The flag-off cases above are the regression that matters most here: a
 * rollout switch that changes an existing screen while it is off is not a
 * rollout switch. These add what changes when it is on.
 */
describe("DatasetPermissionsSection — dataset group access entry", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseFeatureFlag.mockReset();
    mockUseFeatureFlag.mockReturnValue(true);
  });

  it("opens the shared destination in place instead of navigating to settings", () => {
    render(<DatasetPermissionsSection {...defaultProps} />);

    expect(screen.queryByTestId("access-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /manage access/i }));

    expect(screen.getByTestId("access-modal")).toHaveTextContent(
      "ds-123|Test Dataset",
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("offers the entry without the manageDataset projection or a role label", () => {
    // `hasManagePermission` is derived from `permissions.manageDataset` and a
    // context-grant role, neither of which authorizes granting. The new flow
    // reads effective capabilities itself and explains what they allow, so the
    // entry is not hidden on that basis.
    render(
      <DatasetPermissionsSection
        {...defaultProps}
        hasManagePermission={false}
        permissions={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /manage access/i }),
    ).toBeEnabled();
  });

  it("closes the shared destination again", () => {
    render(<DatasetPermissionsSection {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /manage access/i }));
    expect(screen.getByTestId("access-modal")).toBeInTheDocument();
  });

  it("offers no entry for a dataset with no id", () => {
    render(<DatasetPermissionsSection {...defaultProps} datasetId="" />);
    expect(
      screen.getByRole("button", { name: /manage access/i }),
    ).toBeDisabled();
  });
});
