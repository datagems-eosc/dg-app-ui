import { describe, expect, it } from "vitest";
import {
  decodeConfig,
  decodeProcessSnapshot,
  decodeStartResponse,
  decodeStatus,
} from "./decode";
import {
  configWithTestKindStep,
  duplicateConfigPayload,
  explicitNullsProcess,
  identityCensoredProcess,
  ONBOARDING_DEFINITION_ID,
  onboardingConfigPayload,
  runningProcess,
  STEP_DEFINITION_IDS,
  startAcceptedBody,
  startWithoutIdBody,
  stepMissingStatusProcess,
  stepsAbsentProcess,
  stepsEmptyProcess,
  unknownStatusProcess,
} from "./fixtures";
import type { DecodeFailureCode, DecodeResult } from "./types";

const expectFailure = <T>(
  result: DecodeResult<T>,
  code: DecodeFailureCode,
  path: string,
) => {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.failure).toEqual({ code, path });
};

describe("decodeStatus", () => {
  it("preserves InProgress = 0 rather than treating it as absent", () => {
    const result = decodeStatus(0, "status");
    expect(result).toEqual({
      ok: true,
      value: { kind: "known", code: 0, name: "InProgress" },
    });
  });

  it.each([
    [1, "Failed"],
    [2, "Succeeded"],
    [3, "Pending"],
  ])("maps %i to %s", (code, name) => {
    const result = decodeStatus(code, "status");
    expect(result.ok && result.value).toEqual({ kind: "known", code, name });
  });

  it("keeps a status outside the contract as unknown with its code", () => {
    const result = decodeStatus(7, "status");
    expect(result.ok && result.value).toEqual({ kind: "unknown", code: 7 });
  });

  it("rejects an absent status", () => {
    expectFailure(
      decodeStatus(undefined, "status"),
      "missing-required",
      "status",
    );
    expectFailure(decodeStatus(null, "status"), "missing-required", "status");
  });

  it("rejects a non-integer status", () => {
    expectFailure(decodeStatus("2", "status"), "invalid-status", "status");
    expectFailure(decodeStatus(1.5, "status"), "invalid-status", "status");
  });
});

describe("decodeProcessSnapshot", () => {
  it("decodes a running process with distinct identifier roles", () => {
    const result = decodeProcessSnapshot(runningProcess);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.processInstanceId).toBe(runningProcess.id);
    expect(result.value.processDefinitionId).toBe(ONBOARDING_DEFINITION_ID);
    expect(result.value.status).toEqual({
      kind: "known",
      code: 0,
      name: "InProgress",
    });
    expect(result.value.steps).toHaveLength(6);
    // Step instance and step definition are different identifiers.
    const [first] = result.value.steps ?? [];
    expect(first.stepDefinitionId).toBe(STEP_DEFINITION_IDS.onboarding);
    expect(first.stepInstanceId).not.toBe(first.stepDefinitionId);
  });

  it("rejects a 200 whose required identity and status were censored away", () => {
    // Only `dataset.id` survived the censor. This is malformed monitoring, not
    // evidence of forbidden access or of a failed process.
    expectFailure(
      decodeProcessSnapshot(identityCensoredProcess),
      "missing-required",
      "id",
    );
  });

  it("rejects a missing aggregate status", () => {
    expectFailure(
      decodeProcessSnapshot({ id: "a", processId: "b" }),
      "missing-required",
      "status",
    );
  });

  it.each([
    ["", "empty string"],
    [" ", "blank string"],
  ])("rejects an unusable process id (%s)", (id) => {
    expectFailure(decodeProcessSnapshot({ id, status: 0 }), "invalid-id", "id");
  });

  it("rejects a non-object payload", () => {
    expectFailure(decodeProcessSnapshot(null), "not-an-object", "$");
    expectFailure(decodeProcessSnapshot([]), "not-an-object", "$");
    expectFailure(decodeProcessSnapshot("{}"), "not-an-object", "$");
  });

  it("distinguishes absent steps from an empty list", () => {
    const absent = decodeProcessSnapshot(stepsAbsentProcess);
    const empty = decodeProcessSnapshot(stepsEmptyProcess);
    expect(absent.ok && absent.value.steps).toBeUndefined();
    expect(empty.ok && empty.value.steps).toEqual([]);
  });

  it("keeps optional projections absent rather than inventing values", () => {
    const result = decodeProcessSnapshot({ id: "process-1", status: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.processDefinitionId).toBeUndefined();
    expect(result.value.datasetId).toBeUndefined();
    expect(result.value.steps).toBeUndefined();
  });

  it("treats explicit nulls defensively, like absent properties", () => {
    const result = decodeProcessSnapshot(explicitNullsProcess);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.processDefinitionId).toBeUndefined();
    expect(result.value.datasetId).toBeUndefined();
    expect(result.value.steps).toBeUndefined();
    expect(result.value.status).toEqual({
      kind: "known",
      code: 0,
      name: "InProgress",
    });
  });

  it("preserves an unknown aggregate status", () => {
    const result = decodeProcessSnapshot(unknownStatusProcess);
    expect(result.ok && result.value.status).toEqual({
      kind: "unknown",
      code: 7,
    });
  });

  it("rejects a step missing its required status", () => {
    expectFailure(
      decodeProcessSnapshot(stepMissingStatusProcess),
      "missing-required",
      "steps[0].status",
    );
  });

  it("rejects a step missing its required definition id", () => {
    expectFailure(
      decodeProcessSnapshot({
        id: "process-1",
        status: 0,
        steps: [{ id: "step-instance-1", status: 0 }],
      }),
      "missing-required",
      "steps[0].stepId",
    );
  });

  it("rejects a non-array steps projection", () => {
    expectFailure(
      decodeProcessSnapshot({ id: "process-1", status: 0, steps: {} }),
      "not-an-array",
      "steps",
    );
  });

  it("rejects an unusable nested dataset id", () => {
    expectFailure(
      decodeProcessSnapshot({
        id: "process-1",
        status: 0,
        dataset: { id: "" },
      }),
      "invalid-id",
      "dataset.id",
    );
  });
});

describe("decodeStartResponse", () => {
  it("accepts a body carrying the process instance id", () => {
    const result = decodeStartResponse(startAcceptedBody);
    expect(result.ok && result.value).toBe(startAcceptedBody.id);
  });

  it("rejects a 2xx body without an id", () => {
    expectFailure(
      decodeStartResponse(startWithoutIdBody),
      "missing-required",
      "id",
    );
  });
});

describe("decodeConfig", () => {
  it("decodes items and steps with their separate kind enums", () => {
    const result = decodeConfig(onboardingConfigPayload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.items).toHaveLength(2);
    const [onboarding] = result.value.items;
    expect(onboarding.processDefinitionId).toBe(ONBOARDING_DEFINITION_ID);
    // Item kind is WorkflowProcessKind.
    expect(onboarding.kind).toEqual({
      kind: "known",
      code: 0,
      name: "DatasetOnboarding",
    });
    expect(onboarding.steps).toHaveLength(6);
    expect(onboarding.steps[2]).toEqual({
      stepDefinitionId: STEP_DEFINITION_IDS.linking,
      kind: { kind: "known", code: 2, name: "DatasetLinkingReport" },
      order: 2,
      taskId: "DatasetLinkingReport",
    });
  });

  it("accepts a WorkflowDefinitionKind test variant as known", () => {
    // 6-10 are valid definition kinds. Rejecting them would make the
    // checked-in configuration look unrecognised.
    const result = decodeConfig(configWithTestKindStep);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [item] = result.value.items;
    expect(item.steps[0].kind).toEqual({
      kind: "known",
      code: 8,
      name: "DatasetPackagingTest",
    });
    expect(item.steps[1].kind).toEqual({ kind: "unknown", code: 42 });
  });

  it("decodes duplicated step identity without rejecting the payload", () => {
    // Duplicates are a mapping problem for the model to flag, not a decode
    // failure: the payload is still structurally valid.
    const result = decodeConfig(duplicateConfigPayload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items[0].steps).toHaveLength(2);
  });

  it("rejects a step with a missing order", () => {
    expectFailure(
      decodeConfig({
        items: [{ id: "item-1", kind: 0, steps: [{ id: "step-1", kind: 0 }] }],
      }),
      "missing-required",
      "items[0].steps[0].order",
    );
  });

  it("rejects a step with a non-integer order", () => {
    expectFailure(
      decodeConfig({
        items: [
          {
            id: "item-1",
            kind: 0,
            steps: [{ id: "step-1", kind: 0, order: "2" }],
          },
        ],
      }),
      "invalid-order",
      "items[0].steps[0].order",
    );
  });

  it("rejects an item with a missing kind", () => {
    expectFailure(
      decodeConfig({ items: [{ id: "item-1", steps: [] }] }),
      "missing-required",
      "items[0].kind",
    );
  });

  it("returns an empty item list when items are absent", () => {
    const result = decodeConfig({});
    expect(result.ok && result.value.items).toEqual([]);
  });
});
