import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Notice } from "./Notice";

const meta: Meta<typeof Notice> = {
  title: "UI/Notice",
  component: Notice,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "caution", "problem", "success"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Notice>;

/** Dataset page: the recommender answered with nothing. */
export const Neutral: Story = {
  args: {
    tone: "neutral",
    title: "No similar datasets found.",
  },
};

/** Dataset adding: progress updates stopped. */
export const Caution: Story = {
  args: {
    tone: "caution",
    title: "Progress updates are unavailable",
    body: "Showing the last available update.",
  },
};

export const Problem: Story = {
  args: {
    tone: "problem",
    title: "Processing failed",
    body: "The dataset could not be processed.",
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    title: "Processing complete",
  },
};

/** The primary outcome of a view, still running, with an action. */
export const ActiveWithAction: Story = {
  args: {
    tone: "neutral",
    title: "Processing your dataset",
    body: "This usually takes a few minutes.",
    active: true,
    emphasis: true,
    children: (
      <Button type="button" variant="outline">
        Refresh status
      </Button>
    ),
  },
};
