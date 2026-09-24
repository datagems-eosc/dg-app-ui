"use client";

/**
 * Dataset onboarding — the processing view.
 *
 * A presentation component over the accepted `OnboardingView`, plus a few plain
 * props describing how the *read* is going. It owns no HTTP, no session, no
 * storage, no timer and no second copy of the processing state machine: every
 * status, order and permitted action was decided by the pure model and the
 * accepted monitoring hook, and is rendered here as-is.
 *
 * What that buys, concretely:
 *
 *  - no control in this file can start, rerun, cancel or resume anything. The
 *    only two actions are reads, and each one appears only when its caller
 *    supplied a callback — no callback, no control;
 *  - completion never leaks into availability. "Processing complete" describes
 *    processing; whether this user can open the dataset is a separate, local
 *    message beside View dataset, and sharing only appears for an earlier
 *    attempt that actually recorded an unconfirmed or failed outcome;
 *  - one primary outcome, then the steps panel with its automatic-update
 *    status. "Updating…" reflects reads the hooks actually dispatched, never
 *    the polling schedule;
 *  - nothing is focused on mount. Initial heading focus after route navigation
 *    belongs to the page (task 5.3), not to a component that may be mounted
 *    anywhere.
 */

import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { hasNotice } from "@/lib/datasetOnboarding/model";
import type {
  DatasetId,
  NoticeCode,
  OnboardingView,
  PermittedAction,
} from "@/lib/datasetOnboarding/types";
import {
  announcementOf,
  type HeadlineCopy,
  headlineOf,
  type NoticeCopy,
  type NoticeTone,
  noticeCopyOf,
  type ProcessingReadState,
  RECOVERY_NOTICE,
  readNoticeCopyOf,
  readNoticeOf,
  staleBodyOf,
  updateStatusOf,
  updateStatusTextOf,
} from "./presentation";
import { StageList } from "./StageList";

export const PROCESSING_HEADING_ID = "dataset-processing-heading";

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

/**
 * Joins class names without running tailwind-merge.
 *
 * The shared `cn` helper merges through tailwind-merge, which classifies this
 * project's custom typography classes (`text-body-14-regular`,
 * `text-H2-32-semibold`, ...) as `text-*` utilities and therefore drops them
 * whenever a text colour is merged in the same call — verified in this
 * workspace, and the reason a typography class silently disappears from the
 * rendered markup. Typography and colour do not conflict in CSS, so they are
 * concatenated here. The shared helper is protected baseline and is left
 * untouched; the finding is recorded in the handback.
 */
const classes = (
  ...values: ReadonlyArray<string | false | undefined>
): string => values.filter(Boolean).join(" ");

const TONE_SURFACE: Record<NoticeTone, string> = {
  neutral: "border-slate-200 bg-slate-75",
  caution: "border-amber-200 bg-amber-50",
  problem: "border-red-200 bg-red-50",
  success: "border-emerald-200 bg-emerald-50",
};

const TONE_TITLE: Record<NoticeTone, string> = {
  neutral: "text-gray-750",
  caution: "text-amber-900",
  problem: "text-red-800",
  success: "text-emerald-800",
};

const TONE_BODY: Record<NoticeTone, string> = {
  neutral: "text-gray-650",
  caution: "text-amber-800",
  problem: "text-red-700",
  success: "text-emerald-700",
};

const TONE_ICON: Record<NoticeTone, string> = {
  neutral: "text-icon",
  caution: "text-amber-600",
  problem: "text-red-550",
  success: "text-emerald-600",
};

const BannerIcon = ({
  tone,
  active,
}: {
  tone: NoticeTone;
  active: boolean;
}) => {
  const className = classes("mt-0.5 h-5 w-5 shrink-0", TONE_ICON[tone]);
  if (active) {
    return (
      <LoaderCircle
        className={classes(
          className,
          "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden="true"
      />
    );
  }
  switch (tone) {
    case "success":
      return <CircleCheck className={className} aria-hidden="true" />;
    case "problem":
      return <CircleX className={className} aria-hidden="true" />;
    case "caution":
      return <TriangleAlert className={className} aria-hidden="true" />;
    default:
      return <Info className={className} aria-hidden="true" />;
  }
};

/**
 * Adapted from the Notifications export: tinted surface, matching border, icon
 * beside a title and an optional explanatory line. One thing is deliberately
 * missing — the export's dismiss control. A processing outcome that can be
 * closed is an outcome a user can lose, and every state here is meant to
 * persist.
 */
const Banner = ({
  copy,
  active = false,
  emphasis = false,
  children,
}: {
  copy: NoticeCopy;
  active?: boolean;
  emphasis?: boolean;
  children?: ReactNode;
}) => (
  <div className={classes("rounded-xl border p-4", TONE_SURFACE[copy.tone])}>
    <div className="flex items-start gap-3">
      <BannerIcon tone={copy.tone} active={active} />
      <div className="min-w-0 flex-1">
        <p
          className={classes(
            "break-words",
            emphasis ? "text-body-16-semibold" : "text-body-14-medium",
            TONE_TITLE[copy.tone],
          )}
        >
          {copy.title}
        </p>
        {copy.body === undefined ? null : (
          <p
            className={classes(
              "mt-1 break-words text-body-14-regular",
              TONE_BODY[copy.tone],
            )}
          >
            {copy.body}
          </p>
        )}
        {children === undefined ? null : <div className="mt-3">{children}</div>}
      </div>
    </div>
  </div>
);

/**
 * A short line inside a panel, for a fact that qualifies the content right
 * next to it (the steps list, the dataset action). A full banner there would
 * turn every qualification into another warning box.
 */
const InlineNote = ({
  copy,
  busy = false,
  children,
}: {
  copy: NoticeCopy;
  busy?: boolean;
  children?: ReactNode;
}) => {
  const iconClass = classes("mt-0.5 h-4 w-4 shrink-0", TONE_ICON[copy.tone]);
  const Icon = busy
    ? LoaderCircle
    : copy.tone === "caution"
      ? TriangleAlert
      : copy.tone === "problem"
        ? CircleX
        : Info;
  return (
    <div className="flex items-start gap-2">
      <Icon
        className={classes(
          iconClass,
          busy && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className={classes(
            "break-words text-body-14-regular",
            TONE_TITLE[copy.tone],
          )}
        >
          {copy.title}
          {copy.body === undefined ? null : ` ${copy.body}`}
        </p>
        {children === undefined ? null : <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Notice placement
// ---------------------------------------------------------------------------

/**
 * Whether the page can be kept current, and whether the process says more than
 * its headline. Shown directly below the headline, because it explains why the
 * content below it may be out of date.
 */
const READ_HEALTH_NOTICES: readonly NoticeCode[] = [
  "connection-stale",
  "connection-unavailable",
  "connection-forbidden",
  "dmm-ready-while-incomplete",
];

/** Facts about the steps list, shown inside the steps panel. */
const STEP_NOTICES: readonly NoticeCode[] = [
  "configuration-unavailable",
  "configuration-mismatch",
  "configuration-duplicate",
  "step-details-unavailable",
];

const CONNECTION_PROBLEMS: readonly NoticeCode[] = [
  "connection-stale",
  "connection-unavailable",
  "connection-forbidden",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProcessingViewProps {
  /** The accepted model's output. The single source of status and actions. */
  readonly view: OnboardingView;
  /**
   * A dataset title the caller already holds safely. Never looked up here, and
   * never treated as evidence that the dataset exists or can be opened.
   */
  readonly datasetTitle?: string;
  /** How the read itself is going. Derived from the controller, not owned. */
  readonly read?: ProcessingReadState;
  /** The accepted same-tab recovery marker. A reminder, never a grant. */
  readonly sharingNeedsReconciliation?: boolean;
  /**
   * Read-only re-read of the status and, when in scope, dataset access. Shown
   * as the steps header's Refresh status control. Absent callback means no
   * control at all.
   */
  readonly onCheckAgain?: () => void;
  /**
   * Read-only configuration re-read ("Reload steps"). Separate from the status
   * read, and never reported by the automatic-update status.
   */
  readonly onRetryConfiguration?: () => void;
  /** Navigation only, and only with the model's validated dataset id. */
  readonly onViewDataset?: (datasetId: DatasetId) => void;
  /** Overridable so a page can move focus here after route navigation. */
  readonly headingId?: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function ProcessingView({
  view,
  datasetTitle,
  read = {},
  sharingNeedsReconciliation = false,
  onCheckAgain,
  onRetryConfiguration,
  onViewDataset,
  headingId = PROCESSING_HEADING_ID,
}: ProcessingViewProps) {
  const sectionId = useId();
  const stagesHeadingId = `${sectionId}-stages`;
  const unmatchedHeadingId = `${sectionId}-unmatched`;
  const updateStatusId = `${sectionId}-update-status`;

  const forbiddenConnection = hasNotice(view, "connection-forbidden");
  const readNotice = readNoticeOf(read, forbiddenConnection);

  // Before a first snapshot there is nothing to show but the read itself. When
  // that read is not going anywhere, say so — an indefinite spinner over a
  // stopped read is the one state that tells the user nothing at all.
  const promotableNotice: NoticeCode | null =
    readNotice !== null
      ? null
      : forbiddenConnection
        ? "connection-forbidden"
        : hasNotice(view, "connection-unavailable")
          ? "connection-unavailable"
          : null;

  const stalledCopy: NoticeCopy | null =
    readNotice !== null
      ? readNoticeCopyOf(readNotice)
      : promotableNotice !== null
        ? noticeCopyOf(promotableNotice)
        : null;

  const promoted = view.processing === "loading" && stalledCopy !== null;
  const headline: HeadlineCopy = promoted
    ? { ...stalledCopy, active: false }
    : headlineOf(view.processing);

  // --- notices -----------------------------------------------------------
  // Every model notice is still placed somewhere, or is carried in full by
  // another element; placement changes, meaning does not.
  const codes = view.notices.map((notice) => notice.code);
  const present = (code: NoticeCode) => codes.includes(code);

  const readHealthNotices = READ_HEALTH_NOTICES.filter(
    (code) => present(code) && !(promoted && code === promotableNotice),
  );
  const stepNotices = STEP_NOTICES.filter(present);
  const hasConnectionProblem = CONNECTION_PROBLEMS.some(present);
  // A saved earlier attempt and the model's own unconfirmed-sharing notice say
  // the same thing; one message is enough. A current private upload has
  // neither, so it shows nothing about sharing at all.
  const sharingCopy: NoticeCopy | null = present("sharing-failed")
    ? noticeCopyOf("sharing-failed")
    : present("sharing-unconfirmed") || sharingNeedsReconciliation
      ? RECOVERY_NOTICE
      : null;
  // `status-inconsistent` / `status-unknown` are carried in full by the
  // headline of the matching processing state, and `unmatched-steps` is the
  // helper of its own section, so none of them becomes a second banner.

  // --- actions -----------------------------------------------------------
  const referenceInvalid = read.reference === "invalid";
  const modelOffersCheck = view.actions.some((a) => a.code === "check-again");
  // The accepted hook keeps its check callback available before a first
  // snapshot, so a sanitized read failure may expose it. It never manufactures
  // a dataset action, and a missing session has nothing to re-read.
  const fallbackOffersCheck =
    view.processing === "loading" &&
    readNotice !== null &&
    readNotice !== "read-session-unavailable" &&
    readNotice !== "read-reference-invalid";

  const showRefresh =
    onCheckAgain !== undefined &&
    !referenceInvalid &&
    (modelOffersCheck || fallbackOffersCheck);

  // Taken from the action the model permitted, never from `view.datasetId`:
  // holding an id is not the same as having established readability.
  const viewDatasetId = view.actions.find(
    (action): action is PermittedAction & { datasetId: DatasetId } =>
      action.code === "view-dataset" && action.datasetId !== undefined,
  )?.datasetId;
  const showViewDataset =
    onViewDataset !== undefined && viewDatasetId !== undefined;

  const showReloadSteps =
    onRetryConfiguration !== undefined && present("configuration-unavailable");

  // The steps panel carries the refresh control, so it exists whenever there
  // is a snapshot to keep current, even if no step could be placed in it.
  const showStepsPanel = view.processing !== "loading";

  const updateStatus = updateStatusOf(read, hasConnectionProblem);
  const updateStatusText = updateStatusTextOf(updateStatus);
  const updating = updateStatus === "updating";

  // --- announcement ------------------------------------------------------
  const readHealth =
    readNotice !== null
      ? readNotice
      : forbiddenConnection
        ? "forbidden"
        : present("connection-unavailable")
          ? "unavailable"
          : present("connection-stale")
            ? read.phase === "stopped"
              ? "stale-stopped"
              : "stale"
            : "ok";

  const announcement = useMemo(
    () => announcementOf(view.processing, readHealth),
    [view.processing, readHealth],
  );

  const [announced, setAnnounced] = useState("");
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Mount is not a transition, and an equivalent poll is not either. Only a
    // genuine change in outcome or read health reaches the live region, so a
    // long run does not re-announce itself every few seconds. Background
    // requests ("Updating…") are deliberately never announced.
    if (lastKeyRef.current === null) {
      lastKeyRef.current = announcement.key;
      return;
    }
    if (lastKeyRef.current === announcement.key) return;
    lastKeyRef.current = announcement.key;
    setAnnounced(announcement.text);
  }, [announcement]);

  const refreshButton = showRefresh ? (
    <Tooltip content="Refresh status" position="top" className="flex shrink-0">
      {/* Stays enabled while a read runs: the hooks already coalesce a
          request with the one in flight, so guarding here would only change
          which reads a click is allowed to ask for. Focus never moves. */}
      <button
        type="button"
        onClick={onCheckAgain}
        aria-label="Refresh status"
        {...(updateStatusText === ""
          ? {}
          : { "aria-describedby": updateStatusId })}
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-white transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <RefreshCw
          className={classes(
            "h-5 w-5 text-icon",
            updating && "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
      </button>
    </Tooltip>
  ) : null;

  const availabilityCopy: NoticeCopy | null = present("availability-denied")
    ? noticeCopyOf("availability-denied")
    : present("availability-unconfirmed")
      ? read.checkingAccess === true
        ? { tone: "neutral", title: "Checking dataset access…" }
        : noticeCopyOf("availability-unconfirmed")
      : null;
  const showLocalCheck =
    showRefresh &&
    present("availability-unconfirmed") &&
    read.checkingAccess !== true;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <header>
        {/* `text-H2-32-semibold` is a hand-written class in globals.css and
            already carries its own 24px -> 32px breakpoint, so it is used
            alone. The `text-H2-24-semibold sm:text-H2-32-semibold` idiom used
            elsewhere in the app cannot work: Tailwind generates no variant for
            a class it does not own, so the `sm:` half compiles to nothing and
            the heading stays 24px at every width. See the handback. */}
        {/* `tabIndex={-1}` is a passive seam for task 5.3: it makes the heading
            a valid target for `element.focus()` after route navigation without
            putting it in the tab order. Nothing here focuses it — the view
            still takes no focus on mount, wherever it is mounted; the page
            decides when navigation warrants moving focus. */}
        <h1
          id={headingId}
          tabIndex={-1}
          className="text-H2-32-semibold text-gray-750"
        >
          Dataset processing
        </h1>
        {datasetTitle === undefined ? null : (
          <p className="mt-2 break-words text-body-16-regular text-gray-650">
            {datasetTitle}
          </p>
        )}
      </header>

      {/* Polite and atomic: a transition is read once, in full, and never
          interrupts what the user is doing. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announced}
      </div>

      <Banner
        copy={headline}
        // A spinner must not suggest progress we cannot currently observe.
        active={headline.active && !hasConnectionProblem}
        emphasis
      >
        {!showStepsPanel && showRefresh ? (
          <Button type="button" variant="outline" onClick={onCheckAgain}>
            Refresh status
          </Button>
        ) : undefined}
      </Banner>

      {readHealthNotices.length === 0 &&
      (readNotice === null || promoted) ? null : (
        <div className="flex flex-col gap-3">
          {readHealthNotices.map((code) => {
            const copy = noticeCopyOf(code);
            return (
              <Banner
                key={code}
                copy={
                  code === "connection-stale"
                    ? { ...copy, body: staleBodyOf(read.phase) }
                    : copy
                }
              />
            );
          })}
          {readNotice === null || promoted ? null : (
            <Banner copy={readNoticeCopyOf(readNotice)} />
          )}
        </div>
      )}

      {showStepsPanel ? (
        <section
          aria-labelledby={stagesHeadingId}
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2
              id={stagesHeadingId}
              className="text-body-16-semibold text-gray-750"
            >
              Processing steps
            </h2>
            {updateStatusText === "" && refreshButton === null ? null : (
              <div className="flex min-w-0 items-center gap-2">
                {updateStatusText === "" ? null : (
                  <span
                    id={updateStatusId}
                    className={classes(
                      "text-body-14-regular",
                      updateStatus === "retrying" || updateStatus === "stopped"
                        ? "text-amber-800"
                        : "text-gray-650",
                    )}
                  >
                    {updateStatusText}
                  </span>
                )}
                {refreshButton}
              </div>
            )}
          </div>
          {stepNotices.length === 0 ? null : (
            <div className="mt-3 flex flex-col gap-2">
              {stepNotices.map((code) => (
                <InlineNote key={code} copy={noticeCopyOf(code)}>
                  {code === "configuration-unavailable" && showReloadSteps ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onRetryConfiguration}
                    >
                      Reload steps
                    </Button>
                  ) : undefined}
                </InlineNote>
              ))}
            </div>
          )}
          {view.stages.length === 0 ? null : (
            <div className="mt-4">
              <StageList stages={view.stages} labelledBy={stagesHeadingId} />
            </div>
          )}
        </section>
      ) : null}

      {view.unmatchedSteps.length === 0 ? null : (
        <section
          aria-labelledby={unmatchedHeadingId}
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <h2
            id={unmatchedHeadingId}
            className="text-body-16-semibold text-gray-750"
          >
            Additional processing steps
          </h2>
          <p className="mt-1 text-body-14-regular text-gray-650">
            {noticeCopyOf("unmatched-steps").title}
          </p>
          <div className="mt-4">
            <StageList
              stages={view.unmatchedSteps}
              variant="unmatched"
              labelledBy={unmatchedHeadingId}
            />
          </div>
        </section>
      )}

      {availabilityCopy === null && !showViewDataset ? null : (
        <div className="flex flex-col gap-3">
          {availabilityCopy === null ? null : (
            <InlineNote
              copy={availabilityCopy}
              busy={read.checkingAccess === true}
            />
          )}
          {showLocalCheck || showViewDataset ? (
            <div className="flex flex-wrap gap-3">
              {showViewDataset ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => onViewDataset(viewDatasetId)}
                >
                  View dataset
                </Button>
              ) : null}
              {showLocalCheck ? (
                <Button type="button" variant="outline" onClick={onCheckAgain}>
                  Check again
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {sharingCopy === null ? null : <Banner copy={sharingCopy} />}
    </section>
  );
}

export default ProcessingView;
