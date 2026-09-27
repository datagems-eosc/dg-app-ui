/**
 * Dataset group access — one line of operation feedback.
 *
 * Shared by the full editor's rows and the grant-only results, so a change
 * reads the same wherever it is reported. The text carries the meaning; the
 * icon and colour only reinforce it.
 *
 * An acknowledged change is quiet: secondary-text grey beside a check, not a
 * coloured banner. Refused and uncertain outcomes keep their own colours so
 * they are never mistaken for it.
 */

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleActivity } from "./types";

export type FeedbackTone = Exclude<RoleActivity["kind"], "idle">;

const TONE_STYLE: Record<FeedbackTone, string> = {
  pending: "text-gray-650",
  acknowledged: "text-gray-650",
  refused: "text-red-700",
  uncertain: "text-amber-800",
};

const TONE_ICON: Record<FeedbackTone, typeof CheckCircle2> = {
  pending: Loader2,
  acknowledged: CheckCircle2,
  refused: XCircle,
  uncertain: AlertTriangle,
};

export function OperationFeedback({
  id,
  tone,
  text,
  statusOnly = false,
}: {
  id?: string;
  tone: FeedbackTone;
  text: string;
  /**
   * Read to assistive technology only. For a pending change whose control
   * already shows it is busy: the line would otherwise appear and vanish on
   * every fast reply. The element stays, so `aria-describedby` still resolves.
   */
  statusOnly?: boolean;
}) {
  if (statusOnly) {
    return (
      <li id={id} className="sr-only">
        {text}
      </li>
    );
  }
  const Icon = TONE_ICON[tone];
  return (
    // The type scale stays out of `cn`: tailwind-merge reads
    // `text-body-14-regular` as a colour utility and would drop it.
    <li
      id={id}
      className={`text-body-14-regular ${cn("flex items-start gap-2", TONE_STYLE[tone])}`}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          "mt-[3px] h-4 w-4 shrink-0",
          tone === "pending" && "animate-spin motion-reduce:animate-none",
        )}
      />
      <span className="min-w-0 break-words">{text}</span>
    </li>
  );
}
