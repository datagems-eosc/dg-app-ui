/**
 * Synthetic process-snapshot payloads. See `./provenance.ts`.
 *
 * Shapes follow the inspected single-object `GET /workflow-process/{id}`
 * response: camelCase, absent properties omitted rather than null, steps
 * carrying `id` / `stepId` / `status` and **no** kind field.
 */

import type { WorkflowProcessDto } from "../types";
import { ONBOARDING_DEFINITION_ID, STEP_DEFINITION_IDS } from "./config";

export const PROCESS_INSTANCE_ID = "3f2a1d64-0c5b-4d8e-9a31-7b6c2e5f0a14";
export const DATASET_ID = "c1b9e4a7-5d23-4f80-8e6a-9f0d3b7c1e52";

const stepInstance = (suffix: string) =>
  `9a0b1c2d-3e4f-5a6b-7c8d-${suffix.padStart(12, "0")}`;

interface StepSpec {
  readonly definitionId: string;
  readonly status: number;
}

const buildProcess = (
  steps: readonly StepSpec[] | undefined,
  aggregateStatus: number,
  options: { readonly withDataset?: boolean } = {},
): WorkflowProcessDto => ({
  id: PROCESS_INSTANCE_ID,
  processId: ONBOARDING_DEFINITION_ID,
  status: aggregateStatus,
  ...(options.withDataset === false ? {} : { dataset: { id: DATASET_ID } }),
  ...(steps === undefined
    ? {}
    : {
        steps: steps.map((spec, index) => ({
          id: stepInstance(String(index + 1)),
          stepId: spec.definitionId,
          status: spec.status,
        })),
      }),
});

/**
 * Onboarding done, profiling in progress, everything later pending.
 * Aggregate is InProgress = 0 — the value a truthiness check would drop.
 */
export const runningProcess = buildProcess(
  [
    { definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.profiling, status: 0 },
    { definitionId: STEP_DEFINITION_IDS.linking, status: 3 },
    { definitionId: STEP_DEFINITION_IDS.packaging, status: 3 },
    { definitionId: STEP_DEFINITION_IDS.recommendation, status: 3 },
    { definitionId: STEP_DEFINITION_IDS.cddIngest, status: 3 },
  ],
  0,
);

/** Profiling failed; later stages are still Pending and have not run. */
export const failedThenPendingProcess = buildProcess(
  [
    { definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.profiling, status: 1 },
    { definitionId: STEP_DEFINITION_IDS.linking, status: 3 },
    { definitionId: STEP_DEFINITION_IDS.packaging, status: 3 },
  ],
  1,
);

/** Aggregate Succeeded while a step is explicitly Failed — contradictory. */
export const succeededWithFailedStepProcess = buildProcess(
  [
    { definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.profiling, status: 1 },
    { definitionId: STEP_DEFINITION_IDS.linking, status: 2 },
  ],
  2,
);

/** Every configured stage reported Succeeded. */
export const succeededProcess = buildProcess(
  [
    { definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.profiling, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.linking, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.packaging, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.recommendation, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.cddIngest, status: 2 },
  ],
  2,
);

/**
 * Steps arriving in an order unrelated to configured execution order.
 */
export const shuffledStepsProcess = buildProcess(
  [
    { definitionId: STEP_DEFINITION_IDS.linking, status: 3 },
    { definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 },
    { definitionId: STEP_DEFINITION_IDS.profiling, status: 0 },
  ],
  0,
);

/**
 * Aggregate present, step details entirely absent — the `steps` key is missing,
 * which is what a `BrowseWorkflowProcessStep` censor produces. This must never
 * read as "every stage succeeded".
 */
export const stepsAbsentProcess = buildProcess(undefined, 0);

/** The Gateway supplied an empty list rather than omitting the key. */
export const stepsEmptyProcess = buildProcess([], 0);

/** Aggregate status outside the inspected 0-3 contract. */
export const unknownStatusProcess = buildProcess(
  [{ definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 }],
  7,
);

/** A step whose `stepId` matches no configured step. */
export const unmatchedStepProcess = buildProcess(
  [
    { definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 },
    { definitionId: "00000000-dead-4bee-8000-000000000001", status: 0 },
  ],
  0,
);

/** Succeeded aggregate with no dataset projection available. */
export const succeededWithoutDatasetProcess = buildProcess(
  [{ definitionId: STEP_DEFINITION_IDS.onboarding, status: 2 }],
  2,
  { withDataset: false },
);

/**
 * A 200 whose non-prefixed fields were censored away, leaving only the nested
 * dataset projection. Required identity and status are missing, so this is a
 * malformed monitoring response — not proof of denial or of failure.
 */
export const identityCensoredProcess: WorkflowProcessDto = {
  dataset: { id: DATASET_ID },
};

/**
 * Robustness only: explicit nulls where the Gateway would omit the key.
 * Not an observed response shape.
 */
export const explicitNullsProcess: WorkflowProcessDto = {
  id: PROCESS_INSTANCE_ID,
  processId: null,
  status: 0,
  dataset: null,
  steps: null,
};

/** A step missing its required `status`. */
export const stepMissingStatusProcess: WorkflowProcessDto = {
  id: PROCESS_INSTANCE_ID,
  processId: ONBOARDING_DEFINITION_ID,
  status: 0,
  steps: [{ id: stepInstance("1"), stepId: STEP_DEFINITION_IDS.onboarding }],
};

/** Successful start body. */
export const startAcceptedBody = { id: PROCESS_INSTANCE_ID };

/**
 * A 2xx start body without `id`. The service forces `Id` into its builder field
 * set, so this deviates from the contract — yet the mutation may still have
 * been accepted, which is why it must resolve to an unknown outcome.
 */
export const startWithoutIdBody = { processId: ONBOARDING_DEFINITION_ID };
