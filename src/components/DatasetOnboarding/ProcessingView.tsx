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
 *    configured processing; whether the dataset can be opened, searched or
 *    downloaded is a separate, explicitly unconfirmed notice;
 *  - nothing is focused on mount. Initial heading focus after route navigation
 *    belongs to the page (task 5.3), not to a component that may be mounted
 *    anywhere.
 */

import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
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
 * beside a title and an explanatory line. One thing is deliberately missing —
 * the export's dismiss control. A processing outcome that can be closed is an
 * outcome a user can lose, and every state here is meant to persist.
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
        <p
          className={classes(
            "mt-1 break-words text-body-14-regular",
            TONE_BODY[copy.tone],
          )}
        >
          {copy.body}
        </p>
        {children === undefined ? null : <div className="mt-3">{children}</div>}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Notice ordering
// ---------------------------------------------------------------------------

/**
 * Read health first — it explains why everything below it may be incomplete —
 * then status integrity, then what we could not resolve, then access. Sharing
 * and access sit last so they stay adjacent to the actions they qualify.
 */
const NOTICE_ORDER: readonly NoticeCode[] = [
  "connection-stale",
  "connection-unavailable",
  "connection-forbidden",
  "status-inconsistent",
  "status-unknown",
  "configuration-unavailable",
  "configuration-mismatch",
  "configuration-duplicate",
  "step-details-unavailable",
  "unmatched-steps",
  "dmm-ready-while-incomplete",
  "availability-denied",
  "availability-unconfirmed",
  "sharing-failed",
  "sharing-unconfirmed",
];

const orderOf = (code: NoticeCode): number => {
  const index = NOTICE_ORDER.indexOf(code);
  return index < 0 ? NOTICE_ORDER.length : index;
};

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
  /** Read-only re-read. Absent callback means no control at all. */
  readonly onCheckAgain?: () => void;
  /** Read-only configuration re-read. Separate from the status read. */
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
  const headline: HeadlineCopy =
    view.processing === "loading" && stalledCopy !== null
      ? { ...stalledCopy, active: false }
      : headlineOf(view.processing);

  // --- notices -----------------------------------------------------------
  const modelNotices = [...view.notices]
    .map((notice) => notice.code)
    .filter((code) => !(promoted && code === promotableNotice))
    .sort((a, b) => orderOf(a) - orderOf(b));

  const configurationUnavailable = hasNotice(view, "configuration-unavailable");
  const stalePhase = hasNotice(view, "connection-stale");

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

  const showCheckAgain =
    onCheckAgain !== undefined &&
    !referenceInvalid &&
    (modelOffersCheck || fallbackOffersCheck);

  // Taken from the action the model permitted, never from `view.datasetId`:
  // holding an id is not the same as having established readability.
  const viewDatasetId = view.actions.find(
    (action): action is PermittedAction & { datasetId: DatasetId } =>
      action.code === "view-dataset" && action.datasetId !== undefined,
  )?.datasetId;

  const showRetryConfiguration =
    onRetryConfiguration !== undefined && configurationUnavailable;

  // --- announcement ------------------------------------------------------
  const readHealth =
    readNotice !== null
      ? readNotice
      : forbiddenConnection
        ? "forbidden"
        : hasNotice(view, "connection-unavailable")
          ? "unavailable"
          : stalePhase
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
    // long run does not re-announce itself every few seconds.
    if (lastKeyRef.current === null) {
      lastKeyRef.current = announcement.key;
      return;
    }
    if (lastKeyRef.current === announcement.key) return;
    lastKeyRef.current = announcement.key;
    setAnnounced(announcement.text);
  }, [announcement]);

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

      <Banner copy={headline} active={headline.active} emphasis />

      {view.stages.length === 0 ? null : (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2
            id={stagesHeadingId}
            className="text-body-16-semibold text-gray-750"
          >
            Processing stages
          </h2>
          <p className="mt-1 text-body-14-regular text-gray-650">
            In configured order. DataGEMS runs these stages; there is nothing to
            start or repeat here.
          </p>
          <div className="mt-4">
            <StageList stages={view.stages} labelledBy={stagesHeadingId} />
          </div>
        </section>
      )}

      {view.unmatchedSteps.length === 0 ? null : (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2
            id={unmatchedHeadingId}
            className="text-body-16-semibold text-gray-750"
          >
            Other reported steps
          </h2>
          <p className="mt-1 text-body-14-regular text-gray-650">
            These steps are not described by the known configuration, so they
            are listed without a position in the sequence.
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

      {modelNotices.length === 0 &&
      readNotice === null &&
      !sharingNeedsReconciliation ? null : (
        <div className="flex flex-col gap-3">
          {modelNotices.map((code) => {
            const copy = noticeCopyOf(code);
            const resolved =
              code === "connection-stale"
                ? { ...copy, body: staleBodyOf(read.phase) }
                : copy;
            return (
              <Banner key={code} copy={resolved}>
                {code === "configuration-unavailable" &&
                showRetryConfiguration ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetryConfiguration}
                  >
                    Retry loading stages
                  </Button>
                ) : undefined}
              </Banner>
            );
          })}
          {readNotice === null || promoted ? null : (
            <Banner copy={readNoticeCopyOf(readNotice)} />
          )}
          {sharingNeedsReconciliation ? (
            <Banner copy={RECOVERY_NOTICE} />
          ) : null}
        </div>
      )}

      {showCheckAgain || (onViewDataset !== undefined && viewDatasetId) ? (
        <div className="flex flex-wrap gap-3">
          {showCheckAgain ? (
            <Button type="button" variant="outline" onClick={onCheckAgain}>
              Check again
            </Button>
          ) : null}
          {onViewDataset !== undefined && viewDatasetId !== undefined ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => onViewDataset(viewDatasetId)}
            >
              View dataset
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default ProcessingView;
