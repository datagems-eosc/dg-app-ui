"use client";

/**
 * Dataset onboarding — the configured stage rows.
 *
 * Layout only. Every ordering, state and "did this stage run" decision has
 * already been made by the accepted pure model; this component renders what it
 * was handed and adds nothing. In particular it never sorts, never fills a gap
 * with an optimistic default and never derives a stage state from its
 * neighbours.
 *
 * The row hierarchy is adapted from the File Uploader export: a light compact
 * row, the name on the first line, an icon plus status text on the second. The
 * file-transfer parts of that pattern — byte size, progress bar, per-row remove
 * and retry — are deliberately not carried over: a workflow stage has no byte
 * progress and a contributor cannot rerun one.
 */

import {
  CircleCheck,
  CircleHelp,
  CircleMinus,
  CircleX,
  Clock,
  LoaderCircle,
} from "lucide-react";
import type { StageView } from "@/lib/datasetOnboarding/types";
import {
  type StageTone,
  stageLabelOf,
  stageStateCopyOf,
  UNRECOGNISED_STAGE_LABEL,
} from "./presentation";

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

/**
 * Stage state is essential information, not decoration, so every one of these
 * has to be readable rather than merely on-brand. Against the `slate-75`
 * (#fafbfc) row surface the lighter tokens this started with fell below the
 * 4.5:1 that normal-size text needs — emerald-600 at 3.53:1, red-550 at 3.68:1
 * and slate-450 at 2.97:1 — so each moved one or two steps darker within the
 * same existing family. No token was added and no global style changed.
 *
 * The recession that distinguishes a stage that has not run is kept, but it is
 * now the gap between the primary and secondary text colours rather than a
 * colour too faint to read. Measured ratios live in
 * `evidence/correction-01/contrast-results.json`.
 */
const TONE_TEXT: Record<StageTone, string> = {
  success: "text-emerald-700",
  failure: "text-red-600",
  active: "text-gray-750",
  muted: "text-gray-650",
  neutral: "text-gray-750",
};

const StageIcon = ({ tone }: { tone: StageTone }) => {
  const className = classes("h-4 w-4 shrink-0", TONE_TEXT[tone]);
  switch (tone) {
    case "success":
      return <CircleCheck className={className} aria-hidden="true" />;
    case "failure":
      return <CircleX className={className} aria-hidden="true" />;
    case "active":
      // Reduced motion is a setting, not a preference to talk the user out of.
      return (
        <LoaderCircle
          className={classes(
            className,
            "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
      );
    case "muted":
      return <CircleMinus className={className} aria-hidden="true" />;
    default:
      return <Clock className={className} aria-hidden="true" />;
  }
};

const StageRow = ({ stage }: { stage: StageView }) => {
  const label = stageLabelOf(stage.kind);
  const { tone, text } = stageStateCopyOf(stage.state);
  const unrecognised = label === UNRECOGNISED_STAGE_LABEL;

  return (
    <div className="rounded-lg bg-slate-75 px-4 py-3">
      <p
        className={classes(
          "text-body-16-medium break-words",
          // A stage that has not run still names itself, so it recedes to the
          // secondary text colour rather than to the tertiary one the uploader
          // export uses for a row with no live outcome: that lighter tone reads
          // as decoration at 16px and measured only 2.97:1 here.
          tone === "muted" ? "text-gray-650" : "text-gray-750",
          unrecognised && "italic",
        )}
      >
        {label}
      </p>
      <p
        className={classes(
          "mt-1 flex items-center gap-1.5 text-body-14-regular",
          TONE_TEXT[tone],
        )}
      >
        <StageIcon tone={tone} />
        {/* The icon is decorative; the state is always readable as text. */}
        <span className="break-words">{text}</span>
      </p>
    </div>
  );
};

export interface StageListProps {
  readonly stages: readonly StageView[];
  /**
   * `configured` stages carry a confirmed execution order and render as an
   * ordered list. `unmatched` steps have no confirmed position, so they render
   * as an unordered one — the markup itself refuses to imply a sequence.
   */
  readonly variant?: "configured" | "unmatched";
  readonly labelledBy?: string;
}

export function StageList({
  stages,
  variant = "configured",
  labelledBy,
}: StageListProps) {
  const className = "flex list-none flex-col gap-2 p-0";
  const items = stages.map((stage, index) => (
    <li
      // Neither the definition id nor the order is unique: a duplicated
      // configuration entry legitimately repeats both. The position in the
      // model's own output is what makes a row identifiable.
      key={`${index}-${stage.stepInstanceId ?? stage.stepDefinitionId}`}
    >
      <StageRow stage={stage} />
    </li>
  ));

  return variant === "configured" ? (
    <ol className={className} aria-labelledby={labelledBy}>
      {items}
    </ol>
  ) : (
    <ul className={className} aria-labelledby={labelledBy}>
      {items}
    </ul>
  );
}

export default StageList;
