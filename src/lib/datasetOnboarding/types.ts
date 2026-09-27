/**
 * Dataset onboarding — explicit types for the Gateway workflow-process contract.
 *
 * Contract source: dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd`
 * (`WorkflowProcessController`, `App/Model/WorkflowProcess.cs`,
 * `Service/WorkflowProcess/WorkflowProcessConfig.cs`, `Common/Enum/*`).
 * See `./README.md` for the evidence trail and what is *not* established.
 *
 * This module is a leaf: no React, no hooks, no components, no HTTP, no auth.
 */

// ---------------------------------------------------------------------------
// Identifier roles
// ---------------------------------------------------------------------------

/**
 * Five distinct identifiers travel through this feature and are trivially
 * confusable — the earlier legacy path conflated a dataset id with a workflow
 * id. Branding them makes a mix-up a compile error rather than a runtime bug.
 */
declare const brand: unique symbol;
type Branded<TBrand extends string> = string & { readonly [brand]: TBrand };

/** `workflowProcess.id` — one process *instance*; the route parameter. */
export type ProcessInstanceId = Branded<"ProcessInstanceId">;
/** `workflowProcess.processId` — the process *definition*; joins config item `id`. */
export type ProcessDefinitionId = Branded<"ProcessDefinitionId">;
/** `workflowProcess.steps[].id` — one step *instance*. */
export type StepInstanceId = Branded<"StepInstanceId">;
/** `workflowProcess.steps[].stepId` — the step *definition*; joins config step `id`. */
export type StepDefinitionId = Branded<"StepDefinitionId">;
/** `workflowProcess.dataset.id` — the dataset. Present early; not proof of access. */
export type DatasetId = Branded<"DatasetId">;

export const asProcessInstanceId = (value: string) =>
  value as ProcessInstanceId;
export const asProcessDefinitionId = (value: string) =>
  value as ProcessDefinitionId;
export const asStepInstanceId = (value: string) => value as StepInstanceId;
export const asStepDefinitionId = (value: string) => value as StepDefinitionId;
export const asDatasetId = (value: string) => value as DatasetId;

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * `Common/Enum/WorkflowProcessStatus.cs`. `InProgress` is 0, so every check
 * must be an explicit comparison — a truthiness test silently drops it.
 */
export const PROCESS_STATUS_NAMES = {
  0: "InProgress",
  1: "Failed",
  2: "Succeeded",
  3: "Pending",
} as const;

export type ProcessStatusCode = keyof typeof PROCESS_STATUS_NAMES;
export type ProcessStatusName =
  (typeof PROCESS_STATUS_NAMES)[ProcessStatusCode];

/**
 * A numeric status outside the inspected contract stays `unknown` and keeps its
 * raw code. It is never coerced towards success, failure or pending.
 */
export type ProcessStatus =
  | {
      readonly kind: "known";
      readonly code: ProcessStatusCode;
      readonly name: ProcessStatusName;
    }
  | { readonly kind: "unknown"; readonly code: number };

export const isKnownStatusCode = (value: number): value is ProcessStatusCode =>
  value === 0 || value === 1 || value === 2 || value === 3;

// ---------------------------------------------------------------------------
// Configuration kinds — two separate enum spaces
// ---------------------------------------------------------------------------

/**
 * Config *item* kind is `WorkflowProcessKind` (0–5). Config *step* kind is
 * `WorkflowDefinitionKind` (0–10) and legitimately carries the `_test` variants
 * 6–10 in the checked-in default configuration. Conflating the two would make a
 * valid deployed configuration look unknown, so they are modelled separately.
 *
 * Process-instance steps carry **no** kind field at all
 * (`App/Model/WorkflowProcessStep.cs`); they join configuration by `stepId`.
 */
export const PROCESS_KIND_NAMES = {
  0: "DatasetOnboarding",
  1: "DatasetProfiling",
  2: "DatasetLinkingReport",
  3: "DatasetPackaging",
  4: "DatasetRecommendationRegistering",
  5: "CddIngest",
} as const;

export const DEFINITION_KIND_NAMES = {
  0: "DatasetOnboarding",
  1: "DatasetProfiling",
  2: "DatasetLinkingReport",
  3: "DatasetPackaging",
  4: "DatasetRecommendationRegistering",
  5: "CddIngest",
  6: "DatasetOnboardingTest",
  7: "DatasetProfilingTest",
  8: "DatasetPackagingTest",
  9: "DatasetRecommendationRegisteringTest",
  10: "CddIngestTest",
} as const;

export type ProcessKindCode = keyof typeof PROCESS_KIND_NAMES;
export type DefinitionKindCode = keyof typeof DEFINITION_KIND_NAMES;

export type ProcessKind =
  | {
      readonly kind: "known";
      readonly code: ProcessKindCode;
      readonly name: string;
    }
  | { readonly kind: "unknown"; readonly code: number };

export type DefinitionKind =
  | {
      readonly kind: "known";
      readonly code: DefinitionKindCode;
      readonly name: string;
    }
  | { readonly kind: "unknown"; readonly code: number };

export const isKnownProcessKind = (value: number): value is ProcessKindCode =>
  Object.hasOwn(PROCESS_KIND_NAMES, String(value));

export const isKnownDefinitionKind = (
  value: number,
): value is DefinitionKindCode =>
  Object.hasOwn(DEFINITION_KIND_NAMES, String(value));

// ---------------------------------------------------------------------------
// Wire shapes (what the Gateway sends)
// ---------------------------------------------------------------------------

/**
 * Response bodies are camelCase and omit absent properties entirely
 * (`Startup.cs` sets `NullValueHandling.Ignore`), so a missing key is the
 * normal representation of "not projected or censored" — never `null`.
 * Explicit `null` is still accepted defensively by the decoders; it has not
 * been observed on a live response.
 */
export interface WorkflowProcessStepDto {
  readonly id?: string | null;
  readonly stepId?: string | null;
  readonly status?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export interface WorkflowProcessDto {
  readonly id?: string | null;
  readonly processId?: string | null;
  readonly status?: number | null;
  readonly dataset?: { readonly id?: string | null } | null;
  readonly steps?: readonly WorkflowProcessStepDto[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export interface WorkflowProcessConfigStepDto {
  readonly id?: string | null;
  readonly kind?: number | null;
  readonly order?: number | null;
  readonly taskId?: string | null;
}

export interface WorkflowProcessConfigItemDto {
  readonly id?: string | null;
  readonly kind?: number | null;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly steps?: readonly WorkflowProcessConfigStepDto[] | null;
}

export interface WorkflowProcessConfigDto {
  readonly items?: readonly WorkflowProcessConfigItemDto[] | null;
}

// ---------------------------------------------------------------------------
// Decoded domain shapes
// ---------------------------------------------------------------------------

export interface ProcessStepSnapshot {
  readonly stepInstanceId: StepInstanceId;
  readonly stepDefinitionId: StepDefinitionId;
  readonly status: ProcessStatus;
}

export interface ProcessSnapshot {
  readonly processInstanceId: ProcessInstanceId;
  readonly status: ProcessStatus;
  /** Absent when not projected. Absence is not "no definition". */
  readonly processDefinitionId?: ProcessDefinitionId;
  /** Absent when not projected or censored. Absence is not "no dataset". */
  readonly datasetId?: DatasetId;
  /**
   * `undefined` means step details were not supplied at all — not projected, or
   * censored by `BrowseWorkflowProcessStep`. An empty array means the Gateway
   * supplied an empty list. Neither means every stage succeeded.
   */
  readonly steps?: readonly ProcessStepSnapshot[];
}

export interface ConfigStep {
  readonly stepDefinitionId: StepDefinitionId;
  readonly kind: DefinitionKind;
  readonly order: number;
  readonly taskId?: string;
}

export interface ConfigItem {
  readonly processDefinitionId: ProcessDefinitionId;
  readonly kind: ProcessKind;
  readonly name?: string;
  readonly description?: string;
  readonly steps: readonly ConfigStep[];
}

export interface OnboardingConfig {
  readonly items: readonly ConfigItem[];
}

// ---------------------------------------------------------------------------
// Decode outcome
// ---------------------------------------------------------------------------

/**
 * Failure codes are ours. Backend text is never propagated into a decode
 * failure, so nothing here can leak operational detail into the UI.
 */
export type DecodeFailureCode =
  | "not-an-object"
  | "not-an-array"
  | "missing-required"
  | "invalid-id"
  | "invalid-status"
  | "invalid-order"
  | "invalid-kind";

export interface DecodeFailure {
  readonly code: DecodeFailureCode;
  /** Dotted path inside the payload, e.g. `steps[1].stepId`. */
  readonly path: string;
}

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: DecodeFailure };

export const decodeOk = <T>(value: T): DecodeResult<T> => ({ ok: true, value });

export const decodeFailed = <T>(
  code: DecodeFailureCode,
  path: string,
): DecodeResult<T> => ({ ok: false, failure: { code, path } });

// ---------------------------------------------------------------------------
// Start request
// ---------------------------------------------------------------------------

/**
 * `Common/Enum/DataLocationKind.cs`. Only `Staged` is used by the upload flow;
 * the rest are listed so the mapping is explicit rather than a magic number.
 */
export const DATA_LOCATION_KIND = {
  File: 0,
  Http: 1,
  Ftp: 2,
  Remote: 3,
  Staged: 4,
  Database: 5,
} as const;

export type DataLocationKind =
  (typeof DATA_LOCATION_KIND)[keyof typeof DATA_LOCATION_KIND];

export interface DataLocationInput {
  readonly kind: DataLocationKind;
  readonly location: string;
}

/**
 * Mirrors `App/Model/DatasetPersist.cs` as accepted by
 * `POST /workflow-process/onboard`. `OnboardValidator` requires name,
 * description, license, headline, at least one keyword, at least one field of
 * science, datePublished and at least one data location; a `Staged` location
 * must be the only one. It also rejects a caller-supplied `id` as overposting,
 * which is why no id is modelled here.
 */
export interface OnboardingStartInput {
  readonly name: string;
  readonly description: string;
  readonly license: string;
  readonly headline: string;
  readonly keywords: readonly string[];
  readonly fieldOfScience: readonly string[];
  /** ISO `YYYY-MM-DD`; the Gateway field is a `DateOnly`. */
  readonly datePublished: string;
  readonly dataLocations: readonly DataLocationInput[];
  readonly language?: readonly string[];
  readonly country?: readonly string[];
  readonly url?: string;
  readonly citeAs?: string;
  readonly doi?: string;
}

// ---------------------------------------------------------------------------
// Gateway outcomes
// ---------------------------------------------------------------------------

export type GatewayFailure =
  | { readonly kind: "unauthorized"; readonly httpStatus: number }
  | { readonly kind: "forbidden"; readonly httpStatus: number }
  /** 404. The reference could not be resolved; this does not assert deletion. */
  | { readonly kind: "unavailable-reference"; readonly httpStatus: number }
  /** Network failure or 5xx. Retrying is the caller's decision, never ours. */
  | { readonly kind: "transient"; readonly httpStatus?: number }
  /** 2xx whose body could not be decoded, including missing required fields. */
  | {
      readonly kind: "malformed";
      readonly httpStatus: number;
      readonly failure?: DecodeFailure;
    }
  | { readonly kind: "cancelled" };

export type ReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: GatewayFailure };

/**
 * Start is a mutation, so its failure modes are not symmetrical with a read.
 * `rejected` is reserved for responses that are refused *before* the service
 * persists anything; everything else — including a 2xx we could not read — is
 * `unknown`, and an unknown start is never retried automatically.
 */
export type StartOutcome =
  | { readonly kind: "accepted"; readonly processInstanceId: ProcessInstanceId }
  | { readonly kind: "rejected"; readonly httpStatus: number }
  | { readonly kind: "unknown"; readonly failure: GatewayFailure };

// ---------------------------------------------------------------------------
// Access evidence supplied to the model
// ---------------------------------------------------------------------------

/** Derived only from evidence the caller supplies; never from a UUID. */
export type DatasetAvailability = "unknown" | "readable" | "denied";

export type SharingState =
  /**
   * This flow asked for no sharing at all (revision 5: onboarding creates
   * privately and later sharing is a separate action). It is a statement about
   * *our* requests, never about the dataset: it proves neither private nor
   * public access, and it must not be rendered as an outstanding task.
   */
  | "not-requested"
  /** Sharing was requested in some earlier context and never confirmed. */
  | "not-confirmed"
  | "applying"
  | "confirmed"
  | "failed";

export type ConnectionState = "fresh" | "stale" | "unavailable" | "forbidden";

export interface AccessEvidence {
  readonly availability: DatasetAvailability;
  readonly sharing: SharingState;
  /**
   * DMM readiness, when separately established. It never overrides process
   * state and never implies that every capability is available.
   */
  readonly dmmReady?: boolean;
}

// ---------------------------------------------------------------------------
// Derived view model
// ---------------------------------------------------------------------------

export type ProcessingState =
  | "loading"
  | "pending"
  | "running"
  | "failed"
  | "succeeded"
  | "unknown"
  | "inconsistent";

export type StageState =
  | "pending"
  | "running"
  | "failed"
  | "succeeded"
  | "unknown"
  /** Configured, but no matching step arrived. Not success. */
  | "not-reported"
  /** A configured stage after a failure that has not run. */
  | "not-run";

export interface StageView {
  readonly stepDefinitionId: StepDefinitionId;
  readonly stepInstanceId?: StepInstanceId;
  readonly order?: number;
  readonly kind?: DefinitionKind;
  readonly state: StageState;
  readonly statusCode?: number;
}

export type NoticeCode =
  | "step-details-unavailable"
  | "configuration-unavailable"
  | "configuration-mismatch"
  | "configuration-duplicate"
  | "status-inconsistent"
  | "status-unknown"
  | "unmatched-steps"
  | "availability-unconfirmed"
  | "availability-denied"
  | "sharing-unconfirmed"
  | "sharing-failed"
  | "dmm-ready-while-incomplete"
  | "connection-stale"
  | "connection-unavailable"
  | "connection-forbidden";

export interface Notice {
  readonly code: NoticeCode;
}

/**
 * Only the two actions the contract supports today. "Check again" is a read and
 * never a mutation; "view dataset" requires a confirmed identity *and*
 * confirmed readability, because an id alone establishes neither.
 */
export type ActionCode = "check-again" | "view-dataset";

export interface PermittedAction {
  readonly code: ActionCode;
  readonly datasetId?: DatasetId;
}

export interface OnboardingView {
  readonly processing: ProcessingState;
  readonly aggregateStatus?: ProcessStatus;
  readonly stages: readonly StageView[];
  /** Steps whose `stepId` matched no configured step. Order is not invented. */
  readonly unmatchedSteps: readonly StageView[];
  readonly stepDetailsAvailable: boolean;
  readonly configurationMatched: boolean;
  readonly notices: readonly Notice[];
  readonly actions: readonly PermittedAction[];
  readonly datasetId?: DatasetId;
}
