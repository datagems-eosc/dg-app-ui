import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FoldedText } from "./FoldedText";

const citation =
  "Doe, Jane; Roe, Richard; Example, Alex; Sample, Sam; Placeholder, Pat (2022). A synthetic sentiment dictionary: polarity in newspapers. Data set. Example Centre for Digital Humanities. Version 1.2, licensed for research use with attribution to the original authors and the data steward, distributed with a long note that keeps going so the text needs more than four lines in a narrow column.";

const meta: Meta<typeof FoldedText> = {
  title: "UI/FoldedText",
  component: FoldedText,
  tags: ["autodocs"],
  args: {
    about: "citation",
    lines: 4,
    className: "text-sm leading-6 text-gray-650",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, resize: "horizontal", overflow: "auto" }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FoldedText>;

export const Short: Story = {
  args: { text: "Doe, J. (2017). Algebra problems." },
};
export const Long: Story = { args: { text: citation } };
export const Markdown: Story = {
  args: {
    about: "description",
    lines: 6,
    markdown: true,
    className: "text-base leading-6 text-gray-750",
    text: `${citation}\n\n- first point\n- second point\n\n${citation}`,
  },
};
