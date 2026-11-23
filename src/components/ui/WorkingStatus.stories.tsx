import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CHAT_WORKING_MESSAGES,
  CHAT_WORKING_REPEAT,
} from "./chat/chatWorkingStatus";
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

/** Chat: waiting for an answer, with the elapsed time on the right. */
export const ElapsedTime: Story = {
  args: {
    messages: CHAT_WORKING_MESSAGES["in-dataset"],
    repeat: CHAT_WORKING_REPEAT["in-dataset"],
    elapsed: true,
  },
  decorators: [
    (Story) => (
      <div className="w-120">
        <Story />
      </div>
    ),
  ],
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
