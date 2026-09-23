/**
 * Dataset onboarding — view fixtures for component tests and stories.
 *
 * Development and test use only; nothing here reaches the application bundle.
 *
 * Every value below is produced by running the **accepted** decoder and model
 * over the **accepted** synthetic payloads. That is deliberate: a hand-written
 * `OnboardingView` would let a story show a state the model cannot actually
 * produce, and the screenshots would then prove nothing. See
 * `lib/datasetOnboarding/fixtures/provenance.ts` — none of this is captured
 * from a live environment.
 */

import {
  decodeConfig,
  decodeProcessSnapshot,
} from "@/lib/datasetOnboarding/decode";
import {
  configWithTestKindStep,
  duplicateConfigPayload,
  failedThenPendingProcess,
  onboardingConfigPayload,
  runningProcess,
  stepsAbsentProcess,
  succeededProcess,
  succeededWithFailedStepProcess,
  unknownStatusProcess,
  unmatchedStepProcess,
} from "@/lib/datasetOnboarding/fixtures";
import { buildOnboardingView } from "@/lib/datasetOnboarding/model";
import type {
  AccessEvidence,
  ConnectionState,
  OnboardingView,
  WorkflowProcessConfigDto,
  WorkflowProcessDto,
} from "@/lib/datasetOnboarding/types";

const NO_ACCESS: AccessEvidence = {
  availability: "unknown",
  sharing: "not-confirmed",
};

export interface FixtureViewInput {
  readonly process: WorkflowProcessDto | null;
  readonly config?: WorkflowProcessConfigDto | null;
  readonly access?: AccessEvidence;
  readonly connection?: ConnectionState;
}

export const buildFixtureView = ({
  process,
  config = onboardingConfigPayload,
  access = NO_ACCESS,
  connection = "fresh",
}: FixtureViewInput): OnboardingView => {
  let snapshot = null;
  if (process !== null) {
    const decoded = decodeProcessSnapshot(process);
    if (!decoded.ok) {
      throw new Error(`fixture failed to decode: ${decoded.failure.code}`);
    }
    snapshot = decoded.value;
  }

  let decodedConfig = null;
  if (config !== null) {
    const result = decodeConfig(config);
    if (!result.ok) {
      throw new Error(
        `fixture config failed to decode: ${result.failure.code}`,
      );
    }
    decodedConfig = result.value;
  }

  return buildOnboardingView({
    snapshot,
    config: decodedConfig,
    access,
    connection,
  });
};

/** No snapshot yet. The model has no actions at all in this state. */
export const loadingView = buildFixtureView({ process: null });

export const pendingRunningView = buildFixtureView({ process: runningProcess });

/** Profiling failed; packaging and linking are Pending behind it, so not run. */
export const failedView = buildFixtureView({
  process: failedThenPendingProcess,
});

/** Complete, and access deliberately still unknown. */
export const succeededAccessUnknownView = buildFixtureView({
  process: succeededProcess,
});

/** Complete, readability established elsewhere, sharing confirmed. */
export const succeededReadableView = buildFixtureView({
  process: succeededProcess,
  access: { availability: "readable", sharing: "confirmed" },
});

/** Complete, sharing explicitly failed. Processing stays complete. */
export const succeededSharingFailedView = buildFixtureView({
  process: succeededProcess,
  access: { availability: "readable", sharing: "failed" },
});

/** Aggregate Succeeded alongside a Failed step. */
export const inconsistentView = buildFixtureView({
  process: succeededWithFailedStepProcess,
});

/** A read failed after a successful one; the snapshot is kept as stale. */
export const staleView = buildFixtureView({
  process: runningProcess,
  connection: "stale",
});

/** Aggregate arrived, step details did not. Not "everything succeeded". */
export const stepDetailsUnavailableView = buildFixtureView({
  process: stepsAbsentProcess,
});

/** Configuration could not be loaded; the aggregate is still valid. */
export const configurationUnavailableView = buildFixtureView({
  process: runningProcess,
  config: null,
});

/** Repeated definition id and order in the configuration. */
export const duplicateConfigurationView = buildFixtureView({
  process: runningProcess,
  config: duplicateConfigPayload,
});

/** A reported step matching no configured step. */
export const unmatchedStepsView = buildFixtureView({
  process: unmatchedStepProcess,
});

/** Aggregate status outside the inspected contract. */
export const unknownStatusView = buildFixtureView({
  process: unknownStatusProcess,
});

/** A `_test` definition kind (8) and a kind outside the enum (42). */
export const testAndUnknownKindView = buildFixtureView({
  process: runningProcess,
  config: configWithTestKindStep,
});

/** DMM metadata ready while the process is still running. */
export const dmmReadyWhileRunningView = buildFixtureView({
  process: runningProcess,
  access: { availability: "unknown", sharing: "not-confirmed", dmmReady: true },
});

/** Gateway refused the read for this session. */
export const forbiddenView = buildFixtureView({
  process: null,
  connection: "forbidden",
});

/** A long title, to exercise wrapping rather than truncation. */
export const LONG_DATASET_TITLE =
  "Historical meteorological observations for the Eastern Mediterranean basin, hourly aggregates 1979-2024, quality-controlled reanalysis export";
