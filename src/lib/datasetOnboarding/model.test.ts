import { describe, expect, it } from "vitest";
import { decodeConfig, decodeProcessSnapshot } from "./decode";
import {
  DATASET_ID,
  duplicateConfigPayload,
  failedThenPendingProcess,
  onboardingConfigPayload,
  runningProcess,
  STEP_DEFINITION_IDS,
  shuffledConfigPayload,
  shuffledStepsProcess,
  stepsAbsentProcess,
  stepsEmptyProcess,
  succeededProcess,
  succeededWithFailedStepProcess,
  succeededWithoutDatasetProcess,
  unknownStatusProcess,
  unmatchedStepProcess,
} from "./fixtures";
import { buildOnboardingView, hasAction, hasNotice } from "./model";
import {
  type AccessEvidence,
  asStepDefinitionId,
  type ConnectionState,
  type OnboardingConfig,
  type ProcessSnapshot,
  type WorkflowProcessConfigDto,
  type WorkflowProcessDto,
} from "./types";

const snapshotOf = (payload: WorkflowProcessDto): ProcessSnapshot => {
  const decoded = decodeProcessSnapshot(payload);
  if (!decoded.ok)
    throw new Error(`fixture failed to decode: ${decoded.failure.code}`);
  return decoded.value;
};

const configOf = (payload: WorkflowProcessConfigDto): OnboardingConfig => {
  const decoded = decodeConfig(payload);
  if (!decoded.ok)
    throw new Error(`fixture failed to decode: ${decoded.failure.code}`);
  return decoded.value;
};

const NO_ACCESS: AccessEvidence = {
  availability: "unknown",
  sharing: "not-confirmed",
};

const view = (
  payload: WorkflowProcessDto | null,
  configPayload: WorkflowProcessConfigDto | null = onboardingConfigPayload,
  access: AccessEvidence = NO_ACCESS,
  connection: ConnectionState = "fresh",
) =>
  buildOnboardingView({
    snapshot: payload === null ? null : snapshotOf(payload),
    config: configPayload === null ? null : configOf(configPayload),
    access,
    connection,
  });

describe("aggregate processing state", () => {
  it("is loading before the first snapshot", () => {
    const result = view(null);
    expect(result.processing).toBe("loading");
    expect(result.stages).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  it.each([
    ["running", runningProcess],
    ["failed", failedThenPendingProcess],
    ["succeeded", succeededProcess],
  ])("maps the aggregate to %s", (expected, payload) => {
    expect(view(payload).processing).toBe(expected);
  });

  it("keeps an unrecognised aggregate status explicitly unknown", () => {
    const result = view(unknownStatusProcess);
    expect(result.processing).toBe("unknown");
    expect(result.aggregateStatus).toEqual({ kind: "unknown", code: 7 });
    expect(hasNotice(result, "status-unknown")).toBe(true);
  });

  it("preserves InProgress = 0 as running rather than falling through", () => {
    const result = view(runningProcess);
    expect(result.aggregateStatus).toEqual({
      kind: "known",
      code: 0,
      name: "InProgress",
    });
    expect(result.processing).toBe("running");
  });
});

describe("stage ordering and configuration join", () => {
  it("orders stages by configured order, not response order", () => {
    const result = view(shuffledStepsProcess);
    expect(result.stages.map((stage) => stage.order)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(result.stages[0].stepDefinitionId).toBe(
      STEP_DEFINITION_IDS.onboarding,
    );
    expect(result.stages[1].stepDefinitionId).toBe(
      STEP_DEFINITION_IDS.profiling,
    );
  });

  it("orders by configured order when the configuration itself is shuffled", () => {
    const result = view(shuffledStepsProcess, shuffledConfigPayload);
    expect(result.stages.map((stage) => stage.order)).toEqual([0, 1, 5]);
  });

  it("marks configured stages with no reported step as not-reported", () => {
    // Three of six stages reported. The rest are unknown, never success.
    const result = view(shuffledStepsProcess);
    const notReported = result.stages.filter(
      (stage) => stage.state === "not-reported",
    );
    expect(notReported).toHaveLength(3);
    expect(
      result.stages.every(
        (stage) => stage.state !== "succeeded" || stage.statusCode === 2,
      ),
    ).toBe(true);
  });

  it("keeps the aggregate and flags a mismatch when configuration is unavailable", () => {
    const result = view(runningProcess, null);
    expect(result.processing).toBe("running");
    expect(result.configurationMatched).toBe(false);
    expect(result.stages).toEqual([]);
    expect(hasNotice(result, "configuration-unavailable")).toBe(true);
  });

  it("flags a mismatch when no configured item matches the process definition", () => {
    const result = view({ ...runningProcess, processId: "unknown-definition" });
    expect(result.configurationMatched).toBe(false);
    expect(result.processing).toBe("running");
    expect(hasNotice(result, "configuration-mismatch")).toBe(true);
  });

  it("flags a mismatch when the process definition was not projected", () => {
    const { processId: _omitted, ...withoutDefinition } = runningProcess;
    const result = view(withoutDefinition);
    expect(result.configurationMatched).toBe(false);
    expect(hasNotice(result, "configuration-mismatch")).toBe(true);
  });

  it("flags duplicate configuration identity without claiming readiness", () => {
    const result = view(runningProcess, duplicateConfigPayload);
    expect(hasNotice(result, "configuration-duplicate")).toBe(true);
    expect(result.processing).toBe("running");
  });

  it("lists steps the configuration does not describe without inventing order", () => {
    const result = view(unmatchedStepProcess);
    expect(result.unmatchedSteps).toHaveLength(1);
    expect(result.unmatchedSteps[0].order).toBeUndefined();
    expect(hasNotice(result, "unmatched-steps")).toBe(true);
  });
});

describe("step availability", () => {
  it("keeps the aggregate and reports unavailable details when steps are absent", () => {
    const result = view(stepsAbsentProcess);
    expect(result.processing).toBe("running");
    expect(result.stepDetailsAvailable).toBe(false);
    expect(hasNotice(result, "step-details-unavailable")).toBe(true);
    // Every configured stage is unreported: none may read as succeeded.
    expect(result.stages.every((stage) => stage.state === "not-reported")).toBe(
      true,
    );
  });

  it("does not treat an empty step list as every stage having succeeded", () => {
    const result = view(stepsEmptyProcess);
    expect(result.stepDetailsAvailable).toBe(true);
    expect(result.stages.every((stage) => stage.state === "not-reported")).toBe(
      true,
    );
    expect(result.stages.some((stage) => stage.state === "succeeded")).toBe(
      false,
    );
  });
});

describe("failure and contradiction", () => {
  it("identifies the failed stage, preserves earlier success and marks later stages not-run", () => {
    const result = view(failedThenPendingProcess);
    const byDefinition = new Map(
      result.stages.map((stage) => [stage.stepDefinitionId, stage.state]),
    );
    expect(
      byDefinition.get(asStepDefinitionId(STEP_DEFINITION_IDS.onboarding)),
    ).toBe("succeeded");
    expect(
      byDefinition.get(asStepDefinitionId(STEP_DEFINITION_IDS.profiling)),
    ).toBe("failed");
    expect(
      byDefinition.get(asStepDefinitionId(STEP_DEFINITION_IDS.linking)),
    ).toBe("not-run");
    expect(
      byDefinition.get(asStepDefinitionId(STEP_DEFINITION_IDS.packaging)),
    ).toBe("not-run");
    expect(result.processing).toBe("failed");
  });

  it("reports an inconsistency when a succeeded aggregate carries a failed step", () => {
    const result = view(succeededWithFailedStepProcess);
    expect(result.processing).toBe("inconsistent");
    expect(hasNotice(result, "status-inconsistent")).toBe(true);
  });

  it("does not offer a rerun, cancel or stage-start action on failure", () => {
    const result = view(failedThenPendingProcess);
    expect(result.actions.map((action) => action.code)).toEqual([
      "check-again",
    ]);
  });
});

describe("access, sharing and DMM readiness", () => {
  it("offers view-dataset only with both a dataset id and confirmed readability", () => {
    const readable = view(succeededProcess, onboardingConfigPayload, {
      availability: "readable",
      sharing: "confirmed",
    });
    expect(hasAction(readable, "view-dataset")).toBe(true);
    expect(readable.datasetId).toBe(DATASET_ID);

    // An id alone establishes nothing.
    const unknownAccess = view(succeededProcess);
    expect(hasAction(unknownAccess, "view-dataset")).toBe(false);
    expect(unknownAccess.datasetId).toBe(DATASET_ID);

    const noDataset = view(
      succeededWithoutDatasetProcess,
      onboardingConfigPayload,
      {
        availability: "readable",
        sharing: "confirmed",
      },
    );
    expect(hasAction(noDataset, "view-dataset")).toBe(false);
  });

  it("reports completion with an availability notice instead of claiming publication", () => {
    const result = view(succeededProcess);
    expect(result.processing).toBe("succeeded");
    expect(hasNotice(result, "availability-unconfirmed")).toBe(true);
    expect(hasNotice(result, "sharing-unconfirmed")).toBe(true);
  });

  it("surfaces a denied availability", () => {
    const result = view(succeededProcess, onboardingConfigPayload, {
      availability: "denied",
      sharing: "confirmed",
    });
    expect(hasNotice(result, "availability-denied")).toBe(true);
    expect(hasAction(result, "view-dataset")).toBe(false);
  });

  it.each([
    ["succeeded", succeededProcess],
    ["failed", failedThenPendingProcess],
    ["inconsistent", succeededWithFailedStepProcess],
  ])(
    "raises no sharing notice on a %s process when none was requested",
    (_label, payload) => {
      const result = view(payload, onboardingConfigPayload, {
        availability: "unknown",
        sharing: "not-requested",
      });

      // The flow issued no grant, so there is nothing outstanding. Inventing a
      // warning here would give the contributor a task no action can close.
      expect(hasNotice(result, "sharing-unconfirmed")).toBe(false);
      expect(hasNotice(result, "sharing-failed")).toBe(false);
      // …and the silence buys nothing: availability is still unconfirmed.
      expect(hasAction(result, "view-dataset")).toBe(false);
    },
  );

  it("still warns when sharing was requested earlier and never confirmed", () => {
    const requested = view(succeededProcess, onboardingConfigPayload, {
      availability: "unknown",
      sharing: "not-confirmed",
    });

    expect(hasNotice(requested, "sharing-unconfirmed")).toBe(true);
  });

  it("reports failed sharing without touching the process outcome", () => {
    const result = view(succeededProcess, onboardingConfigPayload, {
      availability: "readable",
      sharing: "failed",
    });
    expect(result.processing).toBe("succeeded");
    expect(hasNotice(result, "sharing-failed")).toBe(true);
  });

  it.each([
    ["running", runningProcess],
    ["failed", failedThenPendingProcess],
    ["unknown", unknownStatusProcess],
  ])("never lets DMM readiness overwrite a %s process", (expected, payload) => {
    const result = view(payload, onboardingConfigPayload, {
      ...NO_ACCESS,
      dmmReady: true,
    });
    expect(result.processing).toBe(expected);
    expect(hasNotice(result, "dmm-ready-while-incomplete")).toBe(true);
  });

  it("does not raise the DMM notice once processing actually succeeded", () => {
    const result = view(succeededProcess, onboardingConfigPayload, {
      availability: "readable",
      sharing: "confirmed",
      dmmReady: true,
    });
    expect(hasNotice(result, "dmm-ready-while-incomplete")).toBe(false);
  });

  it("does not derive availability from a successful read", () => {
    // Nothing in a decoded snapshot may promote availability by itself.
    const result = view(succeededProcess);
    expect(hasAction(result, "view-dataset")).toBe(false);
  });
});

describe("connection", () => {
  it.each([
    ["stale", "connection-stale"],
    ["unavailable", "connection-unavailable"],
    ["forbidden", "connection-forbidden"],
  ] as const)("surfaces a %s connection", (connection, code) => {
    const result = view(
      runningProcess,
      onboardingConfigPayload,
      NO_ACCESS,
      connection,
    );
    expect(hasNotice(result, code)).toBe(true);
    // A monitoring failure is not a workflow failure.
    expect(result.processing).toBe("running");
  });

  it("raises no connection notice while fresh", () => {
    const result = view(runningProcess);
    expect(hasNotice(result, "connection-stale")).toBe(false);
    expect(hasNotice(result, "connection-unavailable")).toBe(false);
  });

  it("keeps check-again available as a read-only action", () => {
    const result = view(
      runningProcess,
      onboardingConfigPayload,
      NO_ACCESS,
      "stale",
    );
    expect(hasAction(result, "check-again")).toBe(true);
  });
});
