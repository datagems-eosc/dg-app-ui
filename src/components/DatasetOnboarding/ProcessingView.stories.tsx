/**
 * Development-only state previews for the processing view.
 *
 * Every story is driven by the accepted model over the accepted synthetic
 * fixtures, so a story cannot show a state the application cannot produce. None
 * of it is a capture of a live environment, and none of it proves deployed
 * permissions, dataset availability or that any process actually completed.
 *
 * The frame below reproduces the content column of `app/datasets/add/page.tsx`
 * and nothing else. `DashboardLayout` and `useSession` are deliberately not
 * mounted: a story must not reach for authentication or the network. Actual
 * shell, routing and initial-focus proof belongs to task 5.3.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import {
  configurationUnavailableView,
  dmmReadyWhileRunningView,
  duplicateConfigurationView,
  failedView,
  historicalSharingFailedView,
  historicalSharingUnconfirmedView,
  inconsistentView,
  LONG_DATASET_TITLE,
  loadingView,
  pendingRunningView,
  staleView,
  stepDetailsUnavailableView,
  succeededAccessDeniedView,
  succeededAccessUnknownView,
  succeededReadableView,
  testAndUnknownKindView,
  unknownStatusView,
  unmatchedStepsView,
} from "./fixtures";
import { ProcessingView } from "./ProcessingView";

const ContentFrame = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-white">
    <div className="relative mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:py-10">
      {children}
    </div>
  </div>
);

// Logged rather than left silent so a browser pass can observe that a keyboard
// activation really reached the callback. They remain read-only no-ops.
const log = (what: string) => () => {
  console.log(`[ProcessingView] ${what}`);
};

const meta = {
  title: "Dataset Onboarding/Processing View",
  component: ProcessingView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ContentFrame>
        <Story />
      </ContentFrame>
    ),
  ],
  args: {
    onCheckAgain: log("check-again"),
    onRetryConfiguration: log("retry-configuration"),
    onViewDataset: log("view-dataset"),
  },
} satisfies Meta<typeof ProcessingView>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- current private upload -------------------------------------------------
// `read` mirrors what the page composes from the hooks: `phase` is the
// schedule, `reading` / `checkingAccess` are requests actually in flight.

/** No snapshot yet and a healthy read. The model permits no action. */
export const FirstRead: Story = {
  args: { view: loadingView, read: { phase: "polling", reading: true } },
};

/** Queued or running, between scheduled reads: "Updates automatically". */
export const Running: Story = {
  args: {
    view: pendingRunningView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "polling" },
  },
};

/** The same run while a status read is actually in flight: "Updating…". */
export const RunningWhileUpdating: Story = {
  args: {
    view: pendingRunningView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "polling", reading: true },
  },
};

/** A failure with later stages that never ran. No restart is offered. */
export const FailedWithNotRunStages: Story = {
  args: {
    view: failedView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "stopped" },
  },
};

/** Complete, readability not yet confirmed: a local message and Check again. */
export const CompleteAccessUnconfirmed: Story = {
  args: {
    view: succeededAccessUnknownView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "stopped" },
  },
};

/** Complete while the bounded dataset-access check is running. */
export const CompleteCheckingAccess: Story = {
  args: {
    view: succeededAccessUnknownView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "stopped", checkingAccess: true },
  },
};

/** Readable, so View dataset is the primary action. */
export const CompleteAndReadable: Story = {
  args: {
    view: succeededReadableView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "stopped" },
  },
};

/** Complete, but this session was refused the dataset read. */
export const CompleteAccessDenied: Story = {
  args: {
    view: succeededAccessDeniedView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "stopped" },
  },
};

/** Last-known state preserved after reads failed and monitoring stopped. */
export const StaleLastKnownState: Story = {
  args: {
    view: staleView,
    datasetTitle: "Athens air quality 2024",
    read: { phase: "stopped" },
  },
};

/** A read failed and the monitor will try again on its own. */
export const StaleStillRetrying: Story = {
  args: { view: staleView, read: { phase: "polling" } },
};

/** Aggregate success contradicted by a failed step. Never styled as success. */
export const InconsistentStatus: Story = {
  args: { view: inconsistentView, read: { phase: "stopped" } },
};

/** Wrapping rather than truncation, at both widths. */
export const LongDatasetTitle: Story = {
  args: {
    view: pendingRunningView,
    datasetTitle: LONG_DATASET_TITLE,
    read: { phase: "polling" },
  },
};

export const StepDetailsUnavailable: Story = {
  args: { view: stepDetailsUnavailableView, read: { phase: "polling" } },
};

export const ConfigurationUnavailable: Story = {
  args: { view: configurationUnavailableView, read: { phase: "polling" } },
};

export const DuplicateConfiguration: Story = {
  args: { view: duplicateConfigurationView, read: { phase: "polling" } },
};

export const UnmatchedSteps: Story = {
  args: { view: unmatchedStepsView, read: { phase: "polling" } },
};

export const TestAndUnrecognisedStageKinds: Story = {
  args: { view: testAndUnknownKindView, read: { phase: "polling" } },
};

export const UnknownAggregateStatus: Story = {
  args: { view: unknownStatusView, read: { phase: "polling" } },
};

export const DmmReadyWhileRunning: Story = {
  args: { view: dmmReadyWhileRunningView, read: { phase: "polling" } },
};

/** A 404 on a valid reference: a stopped read, not a deleted process. */
export const ReferenceUnavailable: Story = {
  args: {
    view: loadingView,
    read: {
      phase: "stopped",
      reference: "valid",
      failure: { kind: "unavailable-reference", httpStatus: 404 },
    },
  },
};

/** The URL carries no usable reference, so there is nothing to re-read. */
export const InvalidReference: Story = {
  args: { view: loadingView, read: { phase: "idle", reference: "invalid" } },
};

/** Sanitized session copy. No claim about the workflow, no title carried over. */
export const SessionUnavailable: Story = {
  args: { view: loadingView, read: { phase: "idle", session: "unavailable" } },
};

// --- historical: earlier attempts that recorded a sharing outcome ----------
// Not reachable from today's private upload, which requests no sharing.

/** An earlier attempt's saved record says sharing was never confirmed. */
export const HistoricalSharingUnconfirmed: Story = {
  args: {
    view: historicalSharingUnconfirmedView,
    datasetTitle: "Athens air quality 2024",
    sharingNeedsReconciliation: true,
    read: { phase: "stopped" },
  },
};

/** An earlier attempt whose sharing explicitly failed. */
export const HistoricalSharingFailed: Story = {
  args: { view: historicalSharingFailedView, read: { phase: "stopped" } },
};
