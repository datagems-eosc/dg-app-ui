import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Markdown from "./Markdown";

const sample = [
  "## Dataset overview",
  "",
  "This dataset contains **historical texts** and *knowledge graphs*.",
  "",
  "### Contents",
  "",
  "- Encyclopedic articles",
  "- Structured metadata",
  "",
  "1. Download the archive",
  "2. Extract the files",
  "",
  "See the [source documentation](https://example.com) for details.",
  "",
  "Use the `dataset_id` field, or run:",
  "",
  "```",
  "load('dataset_id')",
  "```",
].join("\n");

const meta: Meta<typeof Markdown> = {
  title: "UI/Markdown",
  component: Markdown,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["full", "compact"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Markdown>;

export const Full: Story = {
  args: {
    content: sample,
    variant: "full",
  },
};

export const Compact: Story = {
  args: {
    content: sample,
    variant: "compact",
    className: "line-clamp-2",
  },
};

export const Sanitised: Story = {
  args: {
    content:
      "Safe content. <script>window.__pwned = true;</script> [bad link](javascript:alert(1)) stays inert.",
    variant: "full",
  },
};
