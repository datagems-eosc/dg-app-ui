/**
 * Dataset onboarding — presentation vocabulary for the processing view.
 *
 * Pure mapping from the accepted model's vocabulary to labels, copy and tone.
 * No React, no state, no fetching: keeping it here means the wording is
 * reviewable and testable on its own, and the components stay layout.
 *
 * Two rules this file exists to enforce:
 *
 *  - nothing here invents a stage meaning, an order, a percentage or a time
 *    estimate. An unrecognised definition kind gets a neutral label, never a
 *    guess and never raw backend text;
 *  - processing completion is only ever about *configured processing*. No
 *    string in this file may say a dataset is public, searchable, downloadable
 *    or shared, because this feature has no evidence for any of that.
 */

import type {
  DefinitionKind,
  GatewayFailure,
  NoticeCode,
  ProcessingState,
  StageState,
} from "@/lib/datasetOnboarding/types";

// ---------------------------------------------------------------------------
// Read health supplied by the controller
// ---------------------------------------------------------------------------

/**
 * Structurally the accepted monitoring hook's `MonitoringPhase`. It is restated
 * rather than imported so the view depends on no hook; `ProcessingView.test.tsx`
 * asserts at compile time that the hook's type is still assignable to this one.
 */
export type ProcessingReadPhase = "idle" | "polling" | "paused" | "stopped";

export interface ProcessingReadState {
  readonly phase?: ProcessingReadPhase;
  /** The controller's `lastFailure`. Sanitized here; never rendered raw. */
  readonly failure?: GatewayFailure | null;
  /** The controller's `reference`. An invalid one hides the read action. */
  readonly reference?: "valid" | "invalid";
  /** Whether a usable session identity exists at all. */
  readonly session?: "available" | "unavailable";
}

/**
 * Notices this view derives from read health. They are deliberately distinct
 * from `NoticeCode`: the model owns what the *process* says, and these say
 * whether we could read it at all.
 */
export type ReadNoticeCode =
  | "read-session-unavailable"
  | "read-reference-invalid"
  | "read-reference-unavailable"
  | "read-access-unavailable";

export type NoticeTone = "neutral" | "caution" | "problem" | "success";

export interface NoticeCopy {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly body: string;
}

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

/**
 * Short labels for the definition kinds in the inspected contract. The `_test`
 * variants (6-10) are real values in the checked-in default configuration, so
 * they are labelled and kept distinguishable rather than hidden or merged into
 * their production counterparts.
 */
const STAGE_LABELS: Record<number, string> = {
  0: "Load dataset",
  1: "Profile data",
  2: "Create linking report",
  3: "Package dataset",
  4: "Register for recommendations",
  5: "Prepare cross-dataset discovery",
  6: "Load dataset (test)",
  7: "Profile data (test)",
  8: "Package dataset (test)",
  9: "Register for recommendations (test)",
  10: "Prepare cross-dataset discovery (test)",
};

/** Used for an unknown kind and for a step with no configuration at all. */
export const UNRECOGNISED_STAGE_LABEL = "Unrecognised stage";

export const stageLabelOf = (kind: DefinitionKind | undefined): string => {
  if (kind === undefined || kind.kind === "unknown") {
    return UNRECOGNISED_STAGE_LABEL;
  }
  return STAGE_LABELS[kind.code] ?? UNRECOGNISED_STAGE_LABEL;
};

// ---------------------------------------------------------------------------
// Stage state
// ---------------------------------------------------------------------------

export type StageTone = "success" | "failure" | "active" | "muted" | "neutral";

export interface StageStateCopy {
  readonly tone: StageTone;
  readonly text: string;
}

/**
 * `not-reported` and `not-run` are separate on purpose. "Not reported" means
 * the configuration describes a stage no step arrived for; "not run" means a
 * stage that is still Pending behind a failure. Neither is success, and neither
 * is failure.
 */
const STAGE_STATE_COPY: Record<StageState, StageStateCopy> = {
  pending: { tone: "neutral", text: "Waiting to start" },
  running: { tone: "active", text: "In progress" },
  succeeded: { tone: "success", text: "Completed" },
  failed: { tone: "failure", text: "Failed" },
  "not-run": { tone: "muted", text: "Not run" },
  "not-reported": { tone: "muted", text: "Not reported" },
  unknown: { tone: "muted", text: "Status not recognised" },
};

export const stageStateCopyOf = (state: StageState): StageStateCopy =>
  STAGE_STATE_COPY[state];

// ---------------------------------------------------------------------------
// Aggregate headline
// ---------------------------------------------------------------------------

export interface HeadlineCopy {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly body: string;
  /** Whether to show an activity indicator. Reduced motion is respected. */
  readonly active: boolean;
}

/**
 * Deliberately absent from every string below: any percentage, any remaining
 * time, any claim about availability, sharing or searchability, and any offer
 * to rerun or cancel. Those are not ours to state.
 */
const HEADLINES: Record<ProcessingState, HeadlineCopy> = {
  loading: {
    tone: "neutral",
    active: true,
    title: "Checking processing status",
    body: "We are reading the current status of this dataset's processing.",
  },
  pending: {
    tone: "neutral",
    active: true,
    title: "Waiting to start",
    body: "Processing has been accepted and has not begun yet.",
  },
  running: {
    tone: "neutral",
    active: true,
    title: "Dataset processing is in progress",
    body: "Stages run one after another. You can leave this page and come back to it.",
  },
  failed: {
    tone: "problem",
    active: false,
    title: "Dataset processing stopped before it finished",
    body: "The stages that had already completed are kept below. A failed run is not resumed and cannot be restarted from here; ask a DataGEMS administrator to look into it.",
  },
  succeeded: {
    tone: "success",
    active: false,
    title: "Dataset processing complete",
    // The aggregate is the only thing that actually reported this. Step details
    // may be absent or censored, so claiming every stage reported success would
    // assert something we may never have been told.
    body: "The process reports that processing is complete. This describes the configured processing only.",
  },
  inconsistent: {
    tone: "caution",
    active: false,
    title: "Processing details are inconsistent",
    body: "The overall status reports success while at least one stage reports failure. We cannot treat this dataset as fully prepared.",
  },
  unknown: {
    tone: "caution",
    active: false,
    title: "The processing status is not recognised",
    body: "The status we received is outside the range this application knows, so we cannot say whether processing is still running.",
  },
};

export const headlineOf = (state: ProcessingState): HeadlineCopy =>
  HEADLINES[state];

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

/**
 * Every `NoticeCode` the accepted model can emit has an entry. Adding a code to
 * the model without a copy entry is a type error, which is the point.
 */
const NOTICE_COPY: Record<NoticeCode, NoticeCopy> = {
  "connection-stale": {
    tone: "caution",
    title: "Updates are temporarily unavailable",
    body: "Showing the last known status.",
  },
  "connection-unavailable": {
    tone: "caution",
    title: "We cannot read the processing status right now",
    body: "This is a problem reading the status, not a report that processing failed.",
  },
  "connection-forbidden": {
    tone: "caution",
    title: "This session cannot read the processing status",
    body: "Access to this process was refused. That is not a statement that the workflow failed or that anything was deleted.",
  },
  "step-details-unavailable": {
    tone: "neutral",
    title: "Stage details are not available",
    body: "The overall status above is what we know. Individual stages were not supplied, so none of them can be treated as finished.",
  },
  "configuration-unavailable": {
    tone: "caution",
    title: "The stage configuration could not be loaded",
    body: "Stage names and their order cannot be confirmed without it.",
  },
  "configuration-mismatch": {
    tone: "caution",
    title: "This process does not match a known stage configuration",
    body: "Reported steps are listed without an execution order, because we cannot confirm one.",
  },
  "configuration-duplicate": {
    tone: "caution",
    title: "The stage configuration contains repeated entries",
    body: "Some stage details cannot be confirmed.",
  },
  "status-inconsistent": {
    tone: "caution",
    title: "The reported status contradicts the reported stages",
    body: "Overall success arrived together with a failed stage.",
  },
  "status-unknown": {
    tone: "caution",
    title: "The reported status is not recognised",
    body: "We keep the raw outcome rather than guessing what it means.",
  },
  "unmatched-steps": {
    tone: "neutral",
    title: "Some reported steps are not in the known configuration",
    // No positional claim: the composition puts that list above the notices.
    body: "Reported steps are shown separately because their position in the run is not confirmed.",
  },
  "availability-unconfirmed": {
    tone: "caution",
    title: "We have not confirmed access to the dataset",
    // Deliberately state-independent: this notice also accompanies a
    // contradictory outcome, and saying "processing finished" there would
    // quietly resolve the very contradiction the status notice is reporting.
    body: "Access to this dataset has not yet been confirmed. Processing status and dataset access are established separately.",
  },
  "availability-denied": {
    tone: "caution",
    title: "This session cannot access the dataset",
    body: "Processing status and dataset access are separate.",
  },
  "sharing-unconfirmed": {
    tone: "caution",
    title: "Sharing has not been confirmed",
    body: "Any sharing you selected has not been confirmed as applied.",
  },
  "sharing-failed": {
    tone: "problem",
    title: "Sharing did not complete",
    body: "Processing and sharing are reported separately. Nothing here retries sharing.",
  },
  "dmm-ready-while-incomplete": {
    tone: "neutral",
    title: "Dataset metadata is ready, processing is not finished",
    body: "Metadata readiness does not mean the remaining stages have completed.",
  },
};

const READ_NOTICE_COPY: Record<ReadNoticeCode, NoticeCopy> = {
  "read-session-unavailable": {
    tone: "caution",
    title: "Processing status cannot be read for this session",
    body: "Sign in again to read this process. Nothing about the process itself is implied.",
  },
  "read-reference-invalid": {
    tone: "caution",
    title: "We could not retrieve this process",
    body: "The address does not carry a usable process reference. This does not mean the process was deleted.",
  },
  "read-reference-unavailable": {
    tone: "caution",
    title: "We could not retrieve this process",
    body: "The reference could not be resolved. This does not mean the process was deleted.",
  },
  "read-access-unavailable": {
    tone: "caution",
    title: "Processing status cannot be read for this session",
    body: "The request was refused. That is not a statement about whether processing succeeded.",
  },
};

/** The same-tab recovery marker. A reminder, never evidence of a grant. */
export const RECOVERY_NOTICE: NoticeCopy = {
  tone: "caution",
  title: "An earlier sharing result still needs checking",
  body: "This process was started in this browser without its sharing outcome being confirmed. Check the dataset's sharing when it is available; nothing is re-applied from here.",
};

export const noticeCopyOf = (code: NoticeCode): NoticeCopy => NOTICE_COPY[code];

export const readNoticeCopyOf = (code: ReadNoticeCode): NoticeCopy =>
  READ_NOTICE_COPY[code];

/**
 * The stale notice's tail depends on whether reads are still being retried.
 * Promising automatic updates after monitoring has stopped would be a lie, so
 * the phase decides the sentence.
 */
export const staleBodyOf = (phase: ProcessingReadPhase | undefined): string =>
  phase === "stopped"
    ? "Showing the last known status. Automatic updates have stopped; use Check again to read it now."
    : "Showing the last known status. We are still trying to reconnect.";

// ---------------------------------------------------------------------------
// Read-health derivation
// ---------------------------------------------------------------------------

/**
 * At most one read notice, by precedence. A missing session outranks the URL,
 * which outranks whatever the last read returned — reporting all three at once
 * would be noise, and the outermost one is the one a user can act on.
 *
 * `transient` and `malformed` produce nothing here: the model already expresses
 * them as a connection state, and duplicating that would say it twice.
 */
export const readNoticeOf = (
  read: ProcessingReadState,
  hasForbiddenConnectionNotice: boolean,
): ReadNoticeCode | null => {
  if (read.session === "unavailable") return "read-session-unavailable";
  if (read.reference === "invalid") return "read-reference-invalid";

  const failure = read.failure ?? null;
  if (failure === null) return null;
  if (failure.kind === "unavailable-reference") {
    return "read-reference-unavailable";
  }
  if (failure.kind === "unauthorized" || failure.kind === "forbidden") {
    return hasForbiddenConnectionNotice ? null : "read-access-unavailable";
  }
  return null;
};

// ---------------------------------------------------------------------------
// Live announcement
// ---------------------------------------------------------------------------

export interface Announcement {
  /** Equal keys mean an equivalent poll: nothing is re-announced. */
  readonly key: string;
  readonly text: string;
}

const READ_HEALTH_SUFFIX: Record<string, string> = {
  stale:
    " Updates are temporarily unavailable; the last known status is shown.",
  "stale-stopped":
    " Updates are temporarily unavailable and have stopped; the last known status is shown.",
  unavailable: " The processing status cannot be read right now.",
  forbidden: " The processing status cannot be read for this session.",
};

/**
 * Summarizes the processing outcome and the health of the read. It deliberately
 * does not mention individual stages: re-reading the list on every poll is what
 * makes a screen reader unusable during a long run.
 */
export const announcementOf = (
  processing: ProcessingState,
  readHealth: string,
): Announcement => ({
  key: `${processing}|${readHealth}`,
  text: `${HEADLINES[processing].title}.${READ_HEALTH_SUFFIX[readHealth] ?? ""}`,
});
