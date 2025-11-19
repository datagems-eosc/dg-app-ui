import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search, X } from "lucide-react";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["medium", "large"],
    },
    disabled: {
      control: "boolean",
    },
    required: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
    size: "medium",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Email",
    name: "email",
    placeholder: "Enter your email",
    size: "medium",
  },
};

export const Required: Story = {
  args: {
    label: "Required Field",
    name: "required",
    placeholder: "This field is required",
    required: true,
    size: "medium",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    name: "email",
    placeholder: "Enter your email",
    error: "Please enter a valid email address",
    size: "medium",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Search",
    name: "search",
    placeholder: "Search...",
    icon: <Search className="w-4 h-4 text-icon" />,
    size: "medium",
  },
};

export const WithRightIcon: Story = {
  args: {
    label: "Search",
    name: "search",
    placeholder: "Search...",
    rightIcon: <X className="w-4 h-4 text-icon" />,
    size: "medium",
  },
};

export const Large: Story = {
  args: {
    label: "Large Input",
    name: "large",
    placeholder: "Large size input",
    size: "large",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled Input",
    name: "disabled",
    placeholder: "This input is disabled",
    disabled: true,
    size: "medium",
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input label="Default" name="default" placeholder="Default input" />
      <Input
        label="With Icon"
        name="with-icon"
        placeholder="Search..."
        icon={<Search className="w-4 h-4 text-icon" />}
      />
      <Input
        label="Required"
        name="required"
        placeholder="Required field"
        required
      />
      <Input
        label="Error State"
        name="error"
        placeholder="Error input"
        error="This field has an error"
      />
      <Input
        label="Disabled"
        name="disabled"
        placeholder="Disabled input"
        disabled
      />
    </div>
  ),
};
