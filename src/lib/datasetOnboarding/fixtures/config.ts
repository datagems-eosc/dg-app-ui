/**
 * Synthetic configuration payloads. See `./provenance.ts`.
 *
 * Item ids, step ids, orders, kinds and task ids are copied from the checked-in
 * `workflow-process.json` at the pinned Gateway revision, so the two enum
 * spaces under test are the ones a real configuration file uses. A deployed
 * configuration may legitimately differ — that is check L9, not an assumption
 * baked in here.
 */

import type { WorkflowProcessConfigDto } from "../types";

/** The onboarding item: `WorkflowProcessKind.DatasetOnboarding` = 0. */
export const ONBOARDING_DEFINITION_ID = "25593b3b-f2b8-4304-bba2-e6eb6e3f4872";

export const STEP_DEFINITION_IDS = {
  onboarding: "8352e21f-a84f-4d41-92c8-30dc05577235",
  profiling: "7d115bb4-21f2-4c70-af08-1cc066aeb033",
  linking: "01f82bae-761b-47bd-9c61-641892cc0279",
  packaging: "bc5ed9e1-ac8c-47b4-b986-7b28165bdc82",
  recommendation: "ebb8dffb-8f5f-447b-9986-8753ae8db398",
  cddIngest: "ed906ed4-5445-4df6-af9f-ffc4dde5300f",
} as const;

/**
 * Six onboarding stages. Note the step `kind` values: 0 and 2 are plain
 * definition kinds while 1, 3, 4 and 5 are... not. In the checked-in file the
 * linking step is the only one whose task id lacks the `_test` suffix, and the
 * step kinds are the `WorkflowDefinitionKind` codes, which is why 6-10 must
 * decode as known rather than unknown — covered by `configWithTestKindStep`.
 */
export const onboardingConfigPayload: WorkflowProcessConfigDto = {
  items: [
    {
      id: ONBOARDING_DEFINITION_ID,
      kind: 0,
      name: "Dataset Onboarding",
      description: "Onboards a new dataset.",
      steps: [
        {
          id: STEP_DEFINITION_IDS.onboarding,
          order: 0,
          kind: 0,
          taskId: "DatasetOnboarding_test",
        },
        {
          id: STEP_DEFINITION_IDS.profiling,
          order: 1,
          kind: 1,
          taskId: "DatasetProfiling_test",
        },
        {
          id: STEP_DEFINITION_IDS.linking,
          order: 2,
          kind: 2,
          taskId: "DatasetLinkingReport",
        },
        {
          id: STEP_DEFINITION_IDS.packaging,
          order: 3,
          kind: 3,
          taskId: "DatasetPackaging_test",
        },
        {
          id: STEP_DEFINITION_IDS.recommendation,
          order: 4,
          kind: 4,
          taskId: "DatasetRecommendationRegistering_test",
        },
        {
          id: STEP_DEFINITION_IDS.cddIngest,
          order: 5,
          kind: 5,
          taskId: "CDD_Ingest_test",
        },
      ],
    },
    {
      // A second item proves the join selects by definition id, not by position.
      id: "97852575-fa6e-4475-9725-7f8f8ff34e03",
      kind: 1,
      name: "Dataset Profiling",
      steps: [
        {
          id: "62a67d16-e9fd-405c-98e8-7fda4cf42bec",
          order: 0,
          kind: 1,
          taskId: "DatasetProfiling_test",
        },
      ],
    },
  ],
};

/**
 * Configuration whose steps arrive with `order` out of sequence. The model must
 * order by `order`, not by array position.
 */
export const shuffledConfigPayload: WorkflowProcessConfigDto = {
  items: [
    {
      id: ONBOARDING_DEFINITION_ID,
      kind: 0,
      steps: [
        { id: STEP_DEFINITION_IDS.cddIngest, order: 5, kind: 5 },
        { id: STEP_DEFINITION_IDS.onboarding, order: 0, kind: 0 },
        { id: STEP_DEFINITION_IDS.profiling, order: 1, kind: 1 },
      ],
    },
  ],
};

/**
 * A configuration step carrying a `WorkflowDefinitionKind` test variant (8 =
 * DatasetPackaging_test) and one carrying a value outside the inspected enum.
 * The first must decode as known; only the second is unknown.
 */
export const configWithTestKindStep: WorkflowProcessConfigDto = {
  items: [
    {
      id: ONBOARDING_DEFINITION_ID,
      kind: 0,
      steps: [
        { id: STEP_DEFINITION_IDS.onboarding, order: 0, kind: 8 },
        { id: STEP_DEFINITION_IDS.profiling, order: 1, kind: 42 },
      ],
    },
  ],
};

/** Two steps claiming the same definition id and the same order. */
export const duplicateConfigPayload: WorkflowProcessConfigDto = {
  items: [
    {
      id: ONBOARDING_DEFINITION_ID,
      kind: 0,
      steps: [
        { id: STEP_DEFINITION_IDS.onboarding, order: 0, kind: 0 },
        { id: STEP_DEFINITION_IDS.onboarding, order: 0, kind: 0 },
      ],
    },
  ],
};
