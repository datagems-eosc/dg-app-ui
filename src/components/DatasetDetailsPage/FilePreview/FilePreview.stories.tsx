import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockFilePreviewData } from "@/data/mockFilePreview";
import FilePreview from "./FilePreview";

const meta = {
  title: "Dataset Details/File Preview",
  component: FilePreview,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FilePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CSVFile: Story = {
  args: {
    fileData: mockFilePreviewData["file1-csv"],
  },
};

export const ExcelFile: Story = {
  args: {
    fileData: mockFilePreviewData["file2-xlsx"],
  },
};

export const PreviewTab: Story = {
  args: {
    fileData: mockFilePreviewData["file1-csv"],
  },
  name: "Preview Tab (CSV)",
};

export const StatisticsTab: Story = {
  args: {
    fileData: mockFilePreviewData["file1-csv"],
  },
  name: "Statistics Tab",
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = canvasElement;
    const statisticsTab = canvas.querySelector("button:nth-child(2)");
    if (statisticsTab instanceof HTMLElement) {
      statisticsTab.click();
    }
  },
};

export const DataQualityTab: Story = {
  args: {
    fileData: mockFilePreviewData["file1-csv"],
  },
  name: "Data Quality Tab",
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = canvasElement;
    const dataQualityTab = canvas.querySelector("button:nth-child(3)");
    if (dataQualityTab instanceof HTMLElement) {
      dataQualityTab.click();
    }
  },
};
