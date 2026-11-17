import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

export type NoticeTone = "neutral" | "caution" | "problem" | "success";

/**
 * Joins class names without running tailwind-merge.
 *
 * The shared `cn` helper merges through tailwind-merge, which classifies this
 * project's custom typography classes (`text-body-14-regular`, ...) as `text-*`
 * utilities and drops them whenever a text colour is merged in the same call.
 * Typography and colour do not conflict in CSS, so they are concatenated here.
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

export const NOTICE_TONE_TITLE: Record<NoticeTone, string> = {
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

export const NOTICE_TONE_ICON: Record<NoticeTone, string> = {
  neutral: "text-icon",
  caution: "text-amber-600",
  problem: "text-red-550",
  success: "text-emerald-600",
};

const NoticeIcon = ({
  tone,
  active,
}: {
  tone: NoticeTone;
  active: boolean;
}) => {
  const className = classes("mt-0.5 h-5 w-5 shrink-0", NOTICE_TONE_ICON[tone]);
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

interface NoticeProps {
  tone: NoticeTone;
  title: string;
  /** Absent when the title already says everything useful. */
  body?: string;
  /** Spinner instead of the tone icon; reduced motion is respected. */
  active?: boolean;
  /** Larger title, for the one primary outcome of a view. */
  emphasis?: boolean;
  /** An action under the text, such as a button. */
  children?: ReactNode;
}

/**
 * A persistent notice box, adapted from the Notifications export: tinted
 * surface, matching border, icon beside a short title and an optional line.
 * Deliberately without the export's dismiss control: a state that can be
 * closed is a state a user can lose.
 */
export function Notice({
  tone,
  title,
  body,
  active = false,
  emphasis = false,
  children,
}: NoticeProps) {
  return (
    <div className={classes("rounded-xl border p-4", TONE_SURFACE[tone])}>
      <div className="flex items-start gap-3">
        <NoticeIcon tone={tone} active={active} />
        <div className="min-w-0 flex-1">
          <p
            className={classes(
              "break-words",
              emphasis ? "text-body-16-semibold" : "text-body-14-medium",
              NOTICE_TONE_TITLE[tone],
            )}
          >
            {title}
          </p>
          {body === undefined ? null : (
            <p
              className={classes(
                "mt-1 break-words text-body-14-regular",
                TONE_BODY[tone],
              )}
            >
              {body}
            </p>
          )}
          {children === undefined ? null : (
            <div className="mt-3">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
