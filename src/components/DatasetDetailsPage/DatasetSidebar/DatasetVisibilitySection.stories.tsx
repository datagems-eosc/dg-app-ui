import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DatasetVisibilitySection from "./DatasetVisibilitySection";

/**
 * The three publication states. `unknown` is the one this change adds: it used
 * to be rendered as a "Restricted" warning chip, which claimed a fact nobody
 * had established.
 */
const meta = {
  title: "DatasetDetails/DatasetVisibilitySection",
  component: DatasetVisibilitySection,
} satisfies Meta<typeof DatasetVisibilitySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Public: Story = { args: { sharing: "public" } };

export const Restricted: Story = { args: { sharing: "restricted" } };

export const Unknown: Story = { args: { sharing: "unknown" } };

export const AllStates: Story = {
  args: { sharing: "unknown" },
  render: () => (
    <div className="flex flex-col gap-6">
      <DatasetVisibilitySection sharing="public" />
      <DatasetVisibilitySection sharing="restricted" />
      <DatasetVisibilitySection sharing="unknown" />
    </div>
  ),
};
