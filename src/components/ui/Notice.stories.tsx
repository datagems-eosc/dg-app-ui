import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { InlineNotice, Notice } from "./Notice";

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
    wrap: {
      control: "radio",
      options: ["anywhere", "words"],
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
    actions: (
      <Button type="button" variant="outline">
        Refresh status
      </Button>
    ),
  },
};

/** Inside a panel: a short line that qualifies the content next to it. */
export const Inline: Story = {
  render: () => (
    <InlineNotice
      tone="caution"
      title="Processing steps are unavailable."
      body="The list below may be incomplete."
      actions={
        <Button type="button" variant="outline" size="sm">
          Reload steps
        </Button>
      }
    />
  ),
};

/** Inline success keeps the plain info icon: it qualifies, it is no outcome. */
export const InlineSuccess: Story = {
  render: () => (
    <InlineNotice tone="success" title="You can open this dataset." />
  ),
};

/** Dataset processing: sentences only, so the body breaks between words. */
export const WordWrap: Story = {
  args: {
    tone: "problem",
    title: "Processing couldn't finish",
    body: "Ask a DataGEMS administrator to check this dataset.",
    wrap: "words",
  },
};

/** Dataset adding: a body with a list, as the upload form uses it. */
export const ListBody: Story = {
  args: {
    tone: "problem",
    title: "Some files need attention",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>measurements_2024_very_long_file_name_without_breaks.csv</li>
        <li>stations.json</li>
      </ul>
    ),
  },
};
