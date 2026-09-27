import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DatasetPermissionsSection from "./DatasetPermissionsSection";

/**
 * Caller permission states, including the two that used to be rendered as a
 * "Viewer" chip the Gateway never reported: an empty read and a read whose
 * evidence could not be interpreted at all.
 */
const meta = {
  title: "DatasetDetails/DatasetPermissionsSection",
  component: DatasetPermissionsSection,
  // The Manage entry navigates with the app router, which Storybook only
  // mounts for stories that declare the app directory.
  parameters: { nextjs: { appDirectory: true } },
  args: {
    datasetId: "ds-1",
    datasetName: "Sea surface temperature",
    hasBrowsePermission: true,
    hasEditPermission: false,
    hasDownloadPermission: false,
    hasManagePermission: false,
    permissions: ["Browse"],
  },
} satisfies Meta<typeof DatasetPermissionsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Known: Story = {
  args: {
    hasEditPermission: true,
    hasDownloadPermission: true,
    permissions: ["Browse", "Edit", "Download"],
  },
};

/** A complete read that returned none of the permissions we display. */
export const EmptyRead: Story = {
  args: { hasBrowsePermission: false, permissions: [] },
};

/** No readable permission evidence at all. */
export const Unavailable: Story = {
  args: { hasBrowsePermission: false, permissions: undefined },
};

/**
 * The widest case: every capability plus the existing Manage entry, which is
 * where the header and the chip row have to stay readable when the sidebar is
 * narrow.
 */
export const AllCapabilitiesWithManage: Story = {
  args: {
    hasEditPermission: true,
    hasDownloadPermission: true,
    hasManagePermission: true,
    permissions: ["Browse", "Edit", "Download", "Manage", "Delete", "Search"],
  },
};

export const AllStates: Story = {
  render: (args) => (
    <div className="flex flex-col gap-8">
      <DatasetPermissionsSection
        {...args}
        hasEditPermission
        hasDownloadPermission
        permissions={["Browse", "Edit", "Download"]}
      />
      <DatasetPermissionsSection
        {...args}
        hasBrowsePermission={false}
        permissions={[]}
      />
      <DatasetPermissionsSection
        {...args}
        hasBrowsePermission={false}
        permissions={undefined}
      />
      <DatasetPermissionsSection
        {...args}
        hasEditPermission
        hasDownloadPermission
        hasManagePermission
        permissions={[
          "Browse",
          "Edit",
          "Download",
          "Manage",
          "Delete",
          "Search",
        ]}
      />
    </div>
  ),
};
