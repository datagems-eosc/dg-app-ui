import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

const meta: Meta<typeof RecommendationsSkeleton> = {
  title: "UI/Chat/RecommendationsSkeleton",
  component: RecommendationsSkeleton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RecommendationsSkeleton>;

export const Default: Story = {};
