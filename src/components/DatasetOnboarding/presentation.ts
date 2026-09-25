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
 *  - no string in this file may say a dataset is public, searchable,
 *    downloadable or shared, because this feature has no evidence for any of
 *    that. Completion describes processing and nothing else.
 *
 * Wording follows the 24 September copy review: say what happened and what the
 * person can do next, once. Uncertainty stays uncertain, but the reasons we
 * cannot be sure (requests, configuration, raw outcomes) stay in code comments.
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
  /**
   * A process status read for the current scope has been dispatched and has
   * not settled. Only the monitoring hook's own dispatch/settlement sets this;
   * `phase === "polling"` is a schedule, not a request, and never implies it.
   */
  readonly reading?: boolean;
  /** Likewise for the availability hook's current-scope dataset read. */
  readonly checkingAccess?: boolean;
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
  /** Absent when the title already says everything useful. */
  readonly body?: string;
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

/**
 * Used for an unknown kind and for a step with no configuration at all. It
 * names no purpose: guessing what an unrecognised step does would be invented.
 */
export const UNRECOGNISED_STAGE_LABEL = "Additional processing step";

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
  "not-reported": { tone: "muted", text: "No update available" },
  unknown: { tone: "muted", text: "Status unavailable" },
};

export const stageStateCopyOf = (state: StageState): StageStateCopy =>
  STAGE_STATE_COPY[state];

// ---------------------------------------------------------------------------
// Aggregate headline
// ---------------------------------------------------------------------------

export interface HeadlineCopy {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly body?: string;
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
    title: "Checking progress…",
  },
  pending: {
    tone: "neutral",
    active: true,
    title: "Waiting to start",
    // Accepted may still mean queued, so nothing here says execution began.
    body: "Your dataset is queued for processing.",
  },
  running: {
    tone: "neutral",
    active: true,
    title: "Processing your dataset",
    body: "You can leave this page and return to check progress.",
  },
  failed: {
    tone: "problem",
    active: false,
    title: "Processing couldn't finish",
    // Completed stages stay visible below; no restart is offered anywhere.
    body: "Ask a DataGEMS administrator to check this dataset.",
  },
  succeeded: {
    tone: "success",
    active: false,
    // Only the aggregate reported this. Step details may be absent or
    // censored, so nothing here claims that every stage reported success, and
    // nothing claims the dataset can be opened, searched or downloaded.
    title: "Processing complete",
  },
  inconsistent: {
    tone: "caution",
    active: false,
    // Carries the `status-inconsistent` notice, which is therefore not
    // rendered a second time below the headline.
    title: "We couldn't confirm that processing completed",
    body: "The progress details don't agree. Ask a DataGEMS administrator to check.",
  },
  unknown: {
    tone: "caution",
    active: false,
    // Carries the `status-unknown` notice in the same way.
    title: "Processing status is unavailable",
    body: "We couldn't confirm the current progress.",
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
    title: "Progress updates are unavailable",
    // The tail depends on whether reads continue; see `staleBodyOf`.
    body: "Showing the last available update.",
  },
  "connection-unavailable": {
    tone: "caution",
    title: "We couldn't check progress",
    // A read problem, not a report that processing failed.
    body: "Processing may still be continuing.",
  },
  "connection-forbidden": {
    tone: "caution",
    // One refused response is neither a failed workflow nor a permanent
    // account policy, so neither is implied.
    title: "You can't view this processing status right now",
    body: "Ask a DataGEMS administrator to check your access.",
  },
  "step-details-unavailable": {
    tone: "neutral",
    // No assertion that steps failed or did not finish.
    title: "Individual step details aren't available.",
  },
  "configuration-unavailable": {
    tone: "caution",
    title: "We couldn't load the processing steps.",
  },
  "configuration-mismatch": {
    tone: "caution",
    title: "The order of some processing steps is unavailable.",
  },
  "configuration-duplicate": {
    tone: "caution",
    title: "Some processing details are unavailable.",
  },
  "status-inconsistent": {
    tone: "caution",
    title: HEADLINES.inconsistent.title,
    body: HEADLINES.inconsistent.body,
  },
  "status-unknown": {
    tone: "caution",
    title: HEADLINES.unknown.title,
    body: HEADLINES.unknown.body,
  },
  "unmatched-steps": {
    tone: "neutral",
    // Rendered as the helper of the additional-steps section, not a banner.
    title: "The order of these steps isn't available.",
  },
  "availability-unconfirmed": {
    tone: "caution",
    // Deliberately state-independent: this also accompanies a contradictory
    // outcome, and saying "processing finished" there would quietly resolve
    // the very contradiction the headline is reporting. No promise of access.
    title: "We couldn't confirm whether you can open this dataset yet.",
  },
  "availability-denied": {
    tone: "caution",
    title: "You can't open this dataset right now.",
    body: "Ask a DataGEMS administrator to check your access.",
  },
  "sharing-unconfirmed": {
    tone: "caution",
    // Compatibility feedback for an earlier attempt. Today's private upload
    // requests no sharing, so this never appears for a normal submission.
    title: "Earlier sharing changes couldn't be confirmed",
    body: "Ask a DataGEMS administrator to check who has access.",
  },
  "sharing-failed": {
    tone: "problem",
    // No claim that earlier grants were rolled back, and no retry.
    title: "Sharing changes weren't completed",
    body: "Ask a DataGEMS administrator to check access.",
  },
  "dmm-ready-while-incomplete": {
    tone: "neutral",
    // Never equated with file or search readiness.
    title: "Dataset details are available. Processing is still underway.",
  },
};

const READ_NOTICE_COPY: Record<ReadNoticeCode, NoticeCopy> = {
  "read-session-unavailable": {
    tone: "caution",
    title: "Please sign in again to view progress",
  },
  "read-reference-invalid": {
    tone: "caution",
    // No deletion claim.
    title: "This progress link is invalid",
    body: "Check that you copied the full link.",
  },
  "read-reference-unavailable": {
    tone: "caution",
    // A 404 is not deletion. Kept distinct from a malformed URL and a denial.
    title: "We couldn't open this progress page",
    body: "Check the link or ask a DataGEMS administrator for help.",
  },
  "read-access-unavailable": {
    tone: "caution",
    title: "You can't view this processing status right now",
    body: "Ask a DataGEMS administrator to check your access.",
  },
};

/**
 * The same-tab recovery marker: a saved earlier attempt whose sharing was never
 * confirmed. A reminder, never evidence of a grant, and nothing is re-applied.
 * It says the same thing as `sharing-unconfirmed`, so the view renders one.
 */
export const RECOVERY_NOTICE: NoticeCopy = NOTICE_COPY["sharing-unconfirmed"];

export const noticeCopyOf = (code: NoticeCode): NoticeCopy => NOTICE_COPY[code];

export const readNoticeCopyOf = (code: ReadNoticeCode): NoticeCopy =>
  READ_NOTICE_COPY[code];

/**
 * The stale notice's tail depends on whether reads continue. Promising an
 * automatic retry after monitoring has stopped would be untrue, so the phase
 * decides the sentence. The header status says "Trying again…" while reads
 * continue, so the notice itself does not repeat it.
 */
export const staleBodyOf = (phase: ProcessingReadPhase | undefined): string =>
  phase === "stopped"
    ? "Showing the last available update. Select Refresh status to try again."
    : "Showing the last available update.";

// ---------------------------------------------------------------------------
// Automatic-update status
// ---------------------------------------------------------------------------

export type UpdateStatus =
  /** Scheduled reads are running and healthy; no request is in flight. */
  | "automatic"
  /** A current-scope process or access read is actually in flight. */
  | "updating"
  /** The last read failed and the monitor will read again on its own. */
  | "retrying"
  /** The monitor stopped after a read problem; only a manual read remains. */
  | "stopped"
  /** The page is hidden; no read will happen until it is visible again. */
  | "paused"
  /** Nothing to say: idle, or stopped because processing finished. */
  | "none";

const UPDATE_STATUS_TEXT: Record<UpdateStatus, string> = {
  automatic: "Updates automatically",
  updating: "Updating…",
  retrying: "Couldn't update. Trying again…",
  stopped: "Automatic updates stopped",
  paused: "Updates paused",
  none: "",
};

/**
 * What the steps header says about keeping the page current.
 *
 * Only actual dispatch/settlement makes it "updating": a process read and an
 * access read may overlap, and either keeps it until both have settled.
 * `phase` alone says what is scheduled, never that a request is running. A
 * normal terminal stop says nothing at all rather than raising an alarm.
 */
export const updateStatusOf = (
  read: ProcessingReadState,
  hasConnectionProblem: boolean,
): UpdateStatus => {
  if (read.reading === true || read.checkingAccess === true) {
    return "updating";
  }
  switch (read.phase) {
    case "polling":
      return hasConnectionProblem ? "retrying" : "automatic";
    case "paused":
      return "paused";
    case "stopped":
      return hasConnectionProblem ? "stopped" : "none";
    default:
      return "none";
  }
};

export const updateStatusTextOf = (status: UpdateStatus): string =>
  UPDATE_STATUS_TEXT[status];

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
    " Progress updates are unavailable. Showing the last available update.",
  "stale-stopped":
    " Progress updates are unavailable and automatic updates stopped. Showing the last available update.",
  unavailable: " We couldn't check progress.",
  forbidden: " You can't view this processing status right now.",
};

/**
 * Summarizes the processing outcome and the health of the read. It deliberately
 * does not mention individual stages: re-reading the list on every poll is what
 * makes a screen reader unusable during a long run.
 */
/** Ends a headline as a sentence without doubling its punctuation. */
const sentence = (text: string): string =>
  /[.…]$/.test(text) ? text : `${text}.`;

export const announcementOf = (
  processing: ProcessingState,
  readHealth: string,
): Announcement => {
  const suffix = READ_HEALTH_SUFFIX[readHealth] ?? "";
  return {
    key: `${processing}|${readHealth}`,
    // Before a first snapshot the view shows the read problem instead of
    // "Checking progress…", so announcing both would contradict itself.
    text:
      processing === "loading" && suffix !== ""
        ? suffix.trim()
        : `${sentence(HEADLINES[processing].title)}${suffix}`,
  };
};
