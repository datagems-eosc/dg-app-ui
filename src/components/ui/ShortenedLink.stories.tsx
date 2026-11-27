import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ShortenedLink } from "./ShortenedLink";

const meta: Meta<typeof ShortenedLink> = {
  title: "UI/ShortenedLink",
  component: ShortenedLink,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        className="text-sm leading-6"
        style={{ width: 280, resize: "horizontal", overflow: "auto" }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ShortenedLink>;

export const Short: Story = {
  args: { href: "https://github.com/example/algebra" },
};
export const Long: Story = {
  args: {
    href: "https://archive.example.edu/dataset/544/estimation+of+obesity+levels+based+on+eating+habits+and+physical+condition",
  },
};
export const Unbroken: Story = {
  args: { href: `https://example.org/${"x".repeat(160)}` },
};
