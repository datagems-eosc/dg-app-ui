import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FoldedChipList } from "./FoldedChipList";

const keywords = [
  "algebra",
  "machine learning",
  "open data",
  "climate",
  "statistics",
  "natural language processing",
  "education",
  "geospatial",
  "water quality",
  "time series",
  "higher education research",
  "public health",
  "knowledge graph",
  "questionnaire",
  "soil moisture",
  "EU",
  "air pollution",
  "census",
];

const meta: Meta<typeof FoldedChipList> = {
  title: "UI/FoldedChipList",
  component: FoldedChipList,
  tags: ["autodocs"],
  args: { label: "Keywords" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, resize: "horizontal", overflow: "auto" }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FoldedChipList>;

export const Few: Story = { args: { items: ["algebra", "rationales"] } };
export const Many: Story = { args: { items: keywords } };
export const VeryLongItem: Story = {
  args: {
    items: [
      "a very specific interdisciplinary keyword phrase that does not fit on one line at all",
      "EU",
    ],
  },
};
export const UnbrokenString: Story = {
  args: { items: ["x".repeat(120), "climate", "census"] },
};
