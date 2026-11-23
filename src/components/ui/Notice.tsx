// clsx, not cn: tailwind-merge drops the text-body-* typography classes when
// a text colour is merged in the same call.
import { clsx } from "clsx";
import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

export type NoticeTone = "neutral" | "caution" | "problem" | "success";

interface ToneStyle {
  surface: string;
  title: string;
  body: string;
  icon: string;
  Glyph: LucideIcon;
}

const TONES: Record<NoticeTone, ToneStyle> = {
  neutral: {
    surface: "border-slate-200 bg-slate-75",
    title: "text-gray-750",
    body: "text-gray-650",
    icon: "text-icon",
    Glyph: Info,
  },
  caution: {
    surface: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    body: "text-amber-800",
    icon: "text-amber-600",
    Glyph: TriangleAlert,
  },
  problem: {
    surface: "border-red-200 bg-red-50",
    title: "text-red-800",
    body: "text-red-700",
    icon: "text-red-550",
    Glyph: CircleX,
  },
  success: {
    surface: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-800",
    body: "text-emerald-700",
    icon: "text-emerald-600",
    Glyph: CircleCheck,
  },
};

/**
 * The tone's icon in the tone's colour, or a spinner while work is running
 * (reduced motion is respected). The caller sets the size.
 */
function NoticeIcon({
  tone,
  active = false,
  glyph = TONES[tone].Glyph,
  className,
}: {
  tone: NoticeTone;
  active?: boolean;
  /** Overrides the tone's own glyph. */
  glyph?: LucideIcon;
  className?: string;
}) {
  const Icon = active ? LoaderCircle : glyph;
  return (
    <Icon
      className={clsx(
        "mt-0.5 shrink-0",
        TONES[tone].icon,
        active && "animate-spin motion-reduce:animate-none",
        className,
      )}
      aria-hidden="true"
    />
  );
}

interface InlineNoticeProps {
  tone: NoticeTone;
  title: string;
  /** Follows the title in the same line. */
  body?: string;
  /** Spinner instead of the tone icon. */
  active?: boolean;
  /** Actions under the text, such as a button. */
  actions?: ReactNode;
}

/**
 * A short line inside a panel, for a fact that qualifies the content right
 * next to it. A full notice box there would turn every qualification into
 * another warning.
 */
export function InlineNotice({
  tone,
  title,
  body,
  active = false,
  actions,
}: InlineNoticeProps) {
  return (
    <div className="flex items-start gap-2">
      <NoticeIcon
        tone={tone}
        active={active}
        // A check mark beside content would read as a second outcome; a
        // qualifying line keeps the plain info glyph for success.
        glyph={tone === "success" ? Info : undefined}
        className="h-4 w-4"
      />
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "break-words text-body-14-regular",
            TONES[tone].title,
          )}
        >
          {title}
          {body === undefined ? null : ` ${body}`}
        </p>
        {actions == null ? null : <div className="mt-2">{actions}</div>}
      </div>
    </div>
  );
}

interface NoticeProps {
  tone: NoticeTone;
  title: string;
  /**
   * Text or markup (paragraphs, a list) under the title. Absent when the
   * title already says everything useful.
   */
  body?: ReactNode;
  /** Spinner instead of the tone icon. */
  active?: boolean;
  /** Larger title, for the one primary outcome of a view. */
  emphasis?: boolean;
  /** Actions under the text, such as a button. */
  actions?: ReactNode;
  /**
   * How the body wraps: "anywhere" (default) for file names and ids without
   * break points, "words" for text that is only sentences.
   */
  wrap?: "anywhere" | "words";
}

/**
 * A persistent notice box, adapted from the Notifications export: tinted
 * surface, matching border, icon beside a short title and an optional body.
 * Deliberately without the export's dismiss control: a state that can be
 * closed is a state a user can lose. Text and icon carry the state; colour
 * only reinforces it.
 */
export function Notice({
  tone,
  title,
  body,
  active = false,
  emphasis = false,
  actions,
  wrap = "anywhere",
}: NoticeProps) {
  return (
    <div
      className={clsx("rounded-xl border p-4", TONES[tone].surface)}
      data-testid="notice"
    >
      <div className="flex items-start gap-3">
        <NoticeIcon tone={tone} active={active} className="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "break-words",
              emphasis ? "text-body-16-semibold" : "text-body-14-medium",
              TONES[tone].title,
            )}
          >
            {title}
          </p>
          {body == null ? null : (
            <div
              className={clsx(
                "mt-1 space-y-1 text-body-14-regular",
                wrap === "words" ? "break-words" : "wrap-anywhere",
                TONES[tone].body,
              )}
            >
              {body}
            </div>
          )}
          {actions == null ? null : <div className="mt-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
