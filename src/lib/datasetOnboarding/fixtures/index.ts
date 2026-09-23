/**
 * Synthetic fixtures for the dataset-onboarding contract.
 *
 * Development and test use only. Nothing here was captured from a live
 * environment — see `./provenance.ts` before treating any of it as evidence of
 * deployed behaviour.
 */

export {
  configWithTestKindStep,
  duplicateConfigPayload,
  ONBOARDING_DEFINITION_ID,
  onboardingConfigPayload,
  STEP_DEFINITION_IDS,
  shuffledConfigPayload,
} from "./config";
export {
  DATASET_ID,
  explicitNullsProcess,
  failedThenPendingProcess,
  identityCensoredProcess,
  PROCESS_INSTANCE_ID,
  runningProcess,
  shuffledStepsProcess,
  startAcceptedBody,
  startWithoutIdBody,
  stepMissingStatusProcess,
  stepsAbsentProcess,
  stepsEmptyProcess,
  succeededProcess,
  succeededWithFailedStepProcess,
  succeededWithoutDatasetProcess,
  unknownStatusProcess,
  unmatchedStepProcess,
} from "./process";
export { FIXTURE_PROVENANCE } from "./provenance";
