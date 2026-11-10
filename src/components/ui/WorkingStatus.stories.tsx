import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkingStatus } from "./WorkingStatus";

const meta: Meta<typeof WorkingStatus> = {
  title: "UI/WorkingStatus",
  component: WorkingStatus,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof WorkingStatus>;

/** Home: classifying a query, messages start over. */
export const Classifying: Story = {
  args: {
    messages: [
      "Working out what you need",
      "Choosing where to take you",
      "Checking how best to help",
    ],
  },
};

/** Datasets: Smart search, stays on the last message during a long wait. */
export const SmartSearch: Story = {
  args: {
    messages: ["Searching inside the data", "Still searching"],
    repeat: false,
    announcement: "Searching for “rainfall data in Central Europe”",
    iconSize: 20,
  },
};
