/**
 * Development-only previews of the stage rows on their own.
 *
 * Useful for checking row density, wrapping and the icon/text pairing without
 * the surrounding banners. Synthetic fixtures only; see `./fixtures.ts`.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import {
  asStepDefinitionId,
  asStepInstanceId,
  type StageState,
  type StageView,
} from "@/lib/datasetOnboarding/types";
import {
  failedView,
  pendingRunningView,
  testAndUnknownKindView,
} from "./fixtures";
import { StageList } from "./StageList";

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="bg-white p-4">
    <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 p-4 sm:p-5">
      {children}
    </div>
  </div>
);

const meta = {
  title: "Dataset Onboarding/Stage List",
  component: StageList,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Panel>
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof StageList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
  args: { stages: pendingRunningView.stages },
};

export const FailedThenNotRun: Story = {
  args: { stages: failedView.stages },
};

export const TestAndUnrecognisedKinds: Story = {
  args: { stages: testAndUnknownKindView.stages },
};

const everyState: readonly StageState[] = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "not-run",
  "not-reported",
  "unknown",
];

/** Every state the model can produce, to compare tone and icon pairing. */
export const EveryStageState: Story = {
  args: {
    stages: everyState.map(
      (state, index): StageView => ({
        stepDefinitionId: asStepDefinitionId(`definition-${index}`),
        stepInstanceId: asStepInstanceId(`instance-${index}`),
        state,
      }),
    ),
  },
};

/** No configuration match, so no sequence may be implied by the markup. */
export const UnmatchedSteps: Story = {
  args: {
    variant: "unmatched",
    stages: [
      {
        stepDefinitionId: asStepDefinitionId("definition-a"),
        stepInstanceId: asStepInstanceId("instance-a"),
        state: "running",
      },
      {
        stepDefinitionId: asStepDefinitionId("definition-b"),
        stepInstanceId: asStepInstanceId("instance-b"),
        state: "succeeded",
      },
    ],
  },
};
