import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ChatRecommendations } from "./ChatRecommendations";

const meta: Meta<typeof ChatRecommendations> = {
  title: "UI/Chat/ChatRecommendations",
  component: ChatRecommendations,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onRecommendationClick: fn(),
  },
  argTypes: {
    isLoading: {
      control: "boolean",
    },
    recommendations: {
      control: "object",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatRecommendations>;

export const Default: Story = {
  args: {
    recommendations: [
      "Machine learning basics",
      "Neural networks",
      "Data preprocessing",
      "Model evaluation",
    ],
    isLoading: false,
  },
};

export const SingleRecommendation: Story = {
  args: {
    recommendations: ["Single recommendation topic"],
    isLoading: false,
  },
};

export const ManyRecommendations: Story = {
  args: {
    recommendations: [
      "Deep learning",
      "Computer vision",
      "Natural language processing",
      "Reinforcement learning",
      "Transfer learning",
      "Generative models",
    ],
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    recommendations: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    recommendations: [],
    isLoading: false,
  },
};

export const NoRecommendations: Story = {
  args: {
    recommendations: undefined,
    isLoading: false,
  },
};
