import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Chip } from "./Chip";

const meta: Meta<typeof Chip> = {
  title: "UI/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["outline", "regular"],
    },
    color: {
      control: "select",
      options: [
        "warning",
        "info",
        "success",
        "error",
        "default",
        "grey",
        "smart-search",
      ],
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: {
    children: "Chip",
    variant: "regular",
    color: "default",
    size: "md",
  },
};

export const Warning: Story = {
  args: {
    children: "Warning",
    variant: "regular",
    color: "warning",
    size: "md",
  },
};

export const Info: Story = {
  args: {
    children: "Info",
    variant: "regular",
    color: "info",
    size: "md",
  },
};

export const Success: Story = {
  args: {
    children: "Success",
    variant: "regular",
    color: "success",
    size: "md",
  },
};

export const ErrorState: Story = {
  args: {
    children: "Error",
    variant: "regular",
    color: "error",
    size: "md",
  },
};

export const WithRemove: Story = {
  args: {
    children: "Removable Chip",
    variant: "regular",
    color: "default",
    size: "md",
    onRemove: () => {},
  },
};

export const Outline: Story = {
  args: {
    children: "Outline Chip",
    variant: "outline",
    color: "default",
    size: "md",
  },
};

export const Small: Story = {
  args: {
    children: "Small",
    variant: "regular",
    color: "default",
    size: "sm",
  },
};

export const ExtraSmall: Story = {
  args: {
    children: "XS",
    variant: "regular",
    color: "default",
    size: "xs",
  },
};

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip color="default">Default</Chip>
      <Chip color="warning">Warning</Chip>
      <Chip color="info">Info</Chip>
      <Chip color="success">Success</Chip>
      <Chip color="error">Error</Chip>
      <Chip color="grey">Grey</Chip>
      <Chip color="smart-search">Smart Search</Chip>
    </div>
  ),
};
