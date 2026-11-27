"use client";

import Markdown from "@ui/Markdown";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { foldToggleClass, useResize } from "./folding";

const FALLBACK_LINE = 24;
/** Folding has to hide at least this many lines to be worth a click. */
const MIN_HIDDEN = 2;

interface FoldedTextProps {
  text: string;
  /** Lines shown while folded. */
  lines: number;
  /** Ends the toggle's accessible name: "Show more of the citation". */
  about: string;
  /** Renders the text as Markdown, as descriptions are written. */
  markdown?: boolean;
  className?: string;
}

/** Long text cut to `lines` lines with "Show more" / "Show less". */
export function FoldedText({
  text,
  lines,
  about,
  markdown = false,
  className,
}: FoldedTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState<number>();
  const [expanded, setExpanded] = useState(false);

  useResize(
    ref,
    (node) => {
      const line =
        Number.parseFloat(getComputedStyle(node).lineHeight) || FALLBACK_LINE;
      const total = Math.round(node.scrollHeight / line);
      setLimit(total - lines >= MIN_HIDDEN ? lines * line : undefined);
    },
    [text, lines],
  );

  const folded = limit !== undefined && !expanded;

  return (
    <div className="min-w-0">
      <div
        ref={ref}
        data-folded={folded}
        className={cn("min-w-0 [overflow-wrap:anywhere]", className)}
        style={folded ? { maxHeight: limit, overflow: "hidden" } : undefined}
      >
        {markdown ? <Markdown content={text} /> : text}
      </div>
      {limit !== undefined && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Show less" : "Show more"} of the ${about}`}
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "mt-1 inline-flex min-h-6 items-center rounded-sm text-sm font-medium underline underline-offset-4 hover:opacity-80",
            foldToggleClass,
          )}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
