import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FoldedNameList } from "./FoldedNameList";

const meta: Meta<typeof FoldedNameList> = {
  title: "UI/FoldedNameList",
  component: FoldedNameList,
  tags: ["autodocs"],
  args: { about: "countries" },
  decorators: [
    (Story) => (
      <div
        className="text-sm leading-6 text-gray-750"
        style={{ width: 320, resize: "horizontal", overflow: "auto" }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FoldedNameList>;

export const One: Story = { args: { items: ["Greece"] } };
export const Many: Story = {
  args: {
    items: [
      "Greece",
      "Portugal",
      "Poland",
      "Germany",
      "France",
      "United States",
      "United Kingdom",
      "Spain",
      "Italy",
      "Netherlands",
      "Sweden",
      "Finland",
      "Czechia",
    ],
  },
};
export const LongName: Story = {
  args: {
    items: [
      "The United Kingdom of Great Britain and Northern Ireland",
      "Spain",
      "Italy",
    ],
  },
};
