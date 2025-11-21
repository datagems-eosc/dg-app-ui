import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Star, X } from "lucide-react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "outline", "secondary", "ghost", "tertiary"],
    },
    size: {
      control: "select",
      options: ["icon", "sm", "smPlus", "md", "lg"],
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: "Button",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    size: "md",
    children: "Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    size: "md",
    children: "Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    size: "md",
    children: "Button",
  },
};

export const Tertiary: Story = {
  args: {
    variant: "tertiary",
    size: "md",
    children: "Button",
  },
};

export const Small: Story = {
  args: {
    variant: "primary",
    size: "sm",
    children: "Small Button",
  },
};

export const Large: Story = {
  args: {
    variant: "primary",
    size: "lg",
    children: "Large Button",
  },
};

export const WithIcon: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: (
      <>
        <Star className="w-4 h-4 mr-2" />
        With Icon
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    variant: "primary",
    size: "icon",
    children: <X className="w-4 h-4" />,
    "aria-label": "Close",
  },
};

export const Disabled: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: "Disabled Button",
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <Button variant="primary">Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="tertiary">Tertiary</Button>
      </div>
      <div className="flex gap-4 items-center">
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="md">
          Medium
        </Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
      </div>
    </div>
  ),
};
