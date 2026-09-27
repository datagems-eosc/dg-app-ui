import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";

const meta: Meta<typeof MarkdownEditor> = {
  title: "UI/MarkdownEditor",
  component: MarkdownEditor,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    required: {
      control: "boolean",
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value ?? "");
    return <MarkdownEditor {...args} value={value} onChange={setValue} />;
  },
};

export default meta;
type Story = StoryObj<typeof MarkdownEditor>;

export const Default: Story = {
  args: {
    label: "Description",
    required: true,
    placeholder: "Provide a detailed description of the dataset contents",
    maxLength: 3000,
    value: "## Overview\n\nDescribe your dataset with **Markdown**.",
  },
};

export const WithError: Story = {
  args: {
    label: "Description",
    required: true,
    maxLength: 3000,
    value: "",
    error: "Description is required",
  },
};
