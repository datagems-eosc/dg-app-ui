/**
 * Dataset onboarding — pure decoders for Gateway workflow-process payloads.
 *
 * Boundary validation only: shape, required identity, status and ordering. No
 * HTTP, no interpretation of what a status *means* (that is `model.ts`), no
 * backend text propagated into a failure.
 *
 * Two rules drive almost everything here:
 *  - status `0` (InProgress) is falsy, so every check is an explicit comparison;
 *  - a 2xx body missing required identity or status is a *malformed monitoring
 *    response*, not evidence of denial, failure or completion. It is rejected
 *    so the caller can say "we could not read this" instead of inventing state.
 */

import {
  asDatasetId,
  asProcessDefinitionId,
  asProcessInstanceId,
  asStepDefinitionId,
  asStepInstanceId,
  type ConfigItem,
  type ConfigStep,
  DEFINITION_KIND_NAMES,
  type DecodeResult,
  type DefinitionKind,
  decodeFailed,
  decodeOk,
  isKnownDefinitionKind,
  isKnownProcessKind,
  isKnownStatusCode,
  type OnboardingConfig,
  PROCESS_KIND_NAMES,
  PROCESS_STATUS_NAMES,
  type ProcessKind,
  type ProcessSnapshot,
  type ProcessStatus,
  type ProcessStepSnapshot,
  type WorkflowProcessConfigDto,
  type WorkflowProcessConfigItemDto,
  type WorkflowProcessConfigStepDto,
  type WorkflowProcessDto,
  type WorkflowProcessStepDto,
} from "./types";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Absent means "not projected or censored"; the Gateway omits nulls, but an
 * explicit `null` is treated the same way defensively.
 */
const isAbsent = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

/**
 * Identifiers are Gateway `Guid`s. We do not enforce the UUID grammar — a
 * deployment could legitimately change format — but an empty or non-string
 * value is never a usable reference.
 */
const isUsableId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const decodeStatus = (
  value: unknown,
  path: string,
): DecodeResult<ProcessStatus> => {
  if (isAbsent(value)) return decodeFailed("missing-required", path);
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return decodeFailed("invalid-status", path);
  }
  if (isKnownStatusCode(value)) {
    return decodeOk({
      kind: "known",
      code: value,
      name: PROCESS_STATUS_NAMES[value],
    });
  }
  // A future or unrecognised status stays unknown and keeps its code; it is
  // never rounded towards success or pending.
  return decodeOk({ kind: "unknown", code: value });
};

const decodeProcessKind = (
  value: unknown,
  path: string,
): DecodeResult<ProcessKind> => {
  if (isAbsent(value)) return decodeFailed("missing-required", path);
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return decodeFailed("invalid-kind", path);
  }
  return isKnownProcessKind(value)
    ? decodeOk({ kind: "known", code: value, name: PROCESS_KIND_NAMES[value] })
    : decodeOk({ kind: "unknown", code: value });
};

const decodeDefinitionKind = (
  value: unknown,
  path: string,
): DecodeResult<DefinitionKind> => {
  if (isAbsent(value)) return decodeFailed("missing-required", path);
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return decodeFailed("invalid-kind", path);
  }
  // 6–10 are the `_test` definition variants and are entirely valid here.
  return isKnownDefinitionKind(value)
    ? decodeOk({
        kind: "known",
        code: value,
        name: DEFINITION_KIND_NAMES[value],
      })
    : decodeOk({ kind: "unknown", code: value });
};

// ---------------------------------------------------------------------------
// Process snapshot
// ---------------------------------------------------------------------------

const decodeStep = (
  value: unknown,
  path: string,
): DecodeResult<ProcessStepSnapshot> => {
  if (!isRecord(value)) return decodeFailed("not-an-object", path);
  const dto = value as WorkflowProcessStepDto;

  if (isAbsent(dto.id)) return decodeFailed("missing-required", `${path}.id`);
  if (!isUsableId(dto.id)) return decodeFailed("invalid-id", `${path}.id`);

  if (isAbsent(dto.stepId)) {
    return decodeFailed("missing-required", `${path}.stepId`);
  }
  if (!isUsableId(dto.stepId)) {
    return decodeFailed("invalid-id", `${path}.stepId`);
  }

  const status = decodeStatus(dto.status, `${path}.status`);
  if (!status.ok) return status;

  return decodeOk({
    stepInstanceId: asStepInstanceId(dto.id),
    stepDefinitionId: asStepDefinitionId(dto.stepId),
    status: status.value,
  });
};

/**
 * Decodes the single-object `GET /workflow-process/{id}` body.
 *
 * `id` and `status` are required: the adapter always projects them, so their
 * absence means the response was censored or malformed rather than simply
 * unprojected. `processId`, `dataset.id` and `steps` are optional and their
 * absence is preserved as "not supplied", never as a negative fact.
 */
export const decodeProcessSnapshot = (
  payload: unknown,
): DecodeResult<ProcessSnapshot> => {
  if (!isRecord(payload)) return decodeFailed("not-an-object", "$");
  const dto = payload as WorkflowProcessDto;

  if (isAbsent(dto.id)) return decodeFailed("missing-required", "id");
  if (!isUsableId(dto.id)) return decodeFailed("invalid-id", "id");

  const status = decodeStatus(dto.status, "status");
  if (!status.ok) return status;

  let processDefinitionId: ProcessSnapshot["processDefinitionId"];
  if (!isAbsent(dto.processId)) {
    if (!isUsableId(dto.processId)) {
      return decodeFailed("invalid-id", "processId");
    }
    processDefinitionId = asProcessDefinitionId(dto.processId);
  }

  let datasetId: ProcessSnapshot["datasetId"];
  if (!isAbsent(dto.dataset)) {
    if (!isRecord(dto.dataset)) return decodeFailed("not-an-object", "dataset");
    if (!isAbsent(dto.dataset.id)) {
      if (!isUsableId(dto.dataset.id)) {
        return decodeFailed("invalid-id", "dataset.id");
      }
      datasetId = asDatasetId(dto.dataset.id);
    }
  }

  let steps: ProcessStepSnapshot[] | undefined;
  if (!isAbsent(dto.steps)) {
    if (!Array.isArray(dto.steps)) return decodeFailed("not-an-array", "steps");
    steps = [];
    for (let index = 0; index < dto.steps.length; index += 1) {
      const decoded = decodeStep(dto.steps[index], `steps[${index}]`);
      if (!decoded.ok) return decoded;
      steps.push(decoded.value);
    }
  }

  return decodeOk({
    processInstanceId: asProcessInstanceId(dto.id),
    status: status.value,
    ...(processDefinitionId === undefined ? {} : { processDefinitionId }),
    ...(datasetId === undefined ? {} : { datasetId }),
    ...(steps === undefined ? {} : { steps }),
  });
};

// ---------------------------------------------------------------------------
// Start response
// ---------------------------------------------------------------------------

/**
 * `ExecuteOnboardingFlow` builds its response with `FieldSet.Build(fields, Id)`,
 * so a successful start always carries `id`. A 2xx body without one therefore
 * deviates from the contract — but the mutation may still have been accepted,
 * so the caller must treat it as unknown, not as failure.
 */
export const decodeStartResponse = (
  payload: unknown,
): DecodeResult<ProcessSnapshot["processInstanceId"]> => {
  if (!isRecord(payload)) return decodeFailed("not-an-object", "$");
  const dto = payload as WorkflowProcessDto;
  if (isAbsent(dto.id)) return decodeFailed("missing-required", "id");
  if (!isUsableId(dto.id)) return decodeFailed("invalid-id", "id");
  return decodeOk(asProcessInstanceId(dto.id));
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const decodeConfigStep = (
  value: unknown,
  path: string,
): DecodeResult<ConfigStep> => {
  if (!isRecord(value)) return decodeFailed("not-an-object", path);
  const dto = value as WorkflowProcessConfigStepDto;

  if (isAbsent(dto.id)) return decodeFailed("missing-required", `${path}.id`);
  if (!isUsableId(dto.id)) return decodeFailed("invalid-id", `${path}.id`);

  if (isAbsent(dto.order)) {
    return decodeFailed("missing-required", `${path}.order`);
  }
  if (typeof dto.order !== "number" || !Number.isInteger(dto.order)) {
    return decodeFailed("invalid-order", `${path}.order`);
  }

  const kind = decodeDefinitionKind(dto.kind, `${path}.kind`);
  if (!kind.ok) return kind;

  return decodeOk({
    stepDefinitionId: asStepDefinitionId(dto.id),
    kind: kind.value,
    order: dto.order,
    ...(typeof dto.taskId === "string" ? { taskId: dto.taskId } : {}),
  });
};

const decodeConfigItem = (
  value: unknown,
  path: string,
): DecodeResult<ConfigItem> => {
  if (!isRecord(value)) return decodeFailed("not-an-object", path);
  const dto = value as WorkflowProcessConfigItemDto;

  if (isAbsent(dto.id)) return decodeFailed("missing-required", `${path}.id`);
  if (!isUsableId(dto.id)) return decodeFailed("invalid-id", `${path}.id`);

  const kind = decodeProcessKind(dto.kind, `${path}.kind`);
  if (!kind.ok) return kind;

  const steps: ConfigStep[] = [];
  if (!isAbsent(dto.steps)) {
    if (!Array.isArray(dto.steps)) {
      return decodeFailed("not-an-array", `${path}.steps`);
    }
    for (let index = 0; index < dto.steps.length; index += 1) {
      const decoded = decodeConfigStep(
        dto.steps[index],
        `${path}.steps[${index}]`,
      );
      if (!decoded.ok) return decoded;
      steps.push(decoded.value);
    }
  }

  return decodeOk({
    processDefinitionId: asProcessDefinitionId(dto.id),
    kind: kind.value,
    ...(typeof dto.name === "string" ? { name: dto.name } : {}),
    ...(typeof dto.description === "string"
      ? { description: dto.description }
      : {}),
    steps,
  });
};

export const decodeConfig = (
  payload: unknown,
): DecodeResult<OnboardingConfig> => {
  if (!isRecord(payload)) return decodeFailed("not-an-object", "$");
  const dto = payload as WorkflowProcessConfigDto;

  const items: ConfigItem[] = [];
  if (!isAbsent(dto.items)) {
    if (!Array.isArray(dto.items)) return decodeFailed("not-an-array", "items");
    for (let index = 0; index < dto.items.length; index += 1) {
      const decoded = decodeConfigItem(dto.items[index], `items[${index}]`);
      if (!decoded.ok) return decoded;
      items.push(decoded.value);
    }
  }

  return decodeOk({ items });
};
