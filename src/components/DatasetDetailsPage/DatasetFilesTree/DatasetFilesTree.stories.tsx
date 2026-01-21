import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DatasetFilesTree from "./DatasetFilesTree";

const meta = {
  title: "Dataset Details/Dataset Files Tree",
  component: DatasetFilesTree,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DatasetFilesTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithSelection: Story = {
  args: {
    onFileSelect: (fileId: string, fileName: string) => {
      console.log("Selected file:", fileId, fileName);
    },
  },
};

export const ExpandedCSVFolder: Story = {
  args: {
    defaultExpanded: ["csv-folder"],
    onFileSelect: (fileId: string, fileName: string) => {
      console.log("Selected file:", fileId, fileName);
    },
  },
};

export const FullyExpanded: Story = {
  args: {
    defaultExpanded: [
      "csv-folder",
      "excel-folder",
      "excel-file1",
      "database-folder",
      "meteo-db",
      "schema1",
      "schema2",
    ],
    onFileSelect: (fileId: string, fileName: string) => {
      console.log("Selected file:", fileId, fileName);
    },
  },
};
