"use client";

import { useRef, useState } from "react";
import { presentValues } from "@/lib/datasetOverview";
import { cn } from "@/lib/utils";
import { foldToggleClass, useResize } from "./folding";

/** Used when the computed line height is not a number (jsdom, `normal`). */
const FALLBACK_LINE = 24;

interface FoldedNameListProps {
  items: readonly string[];
  /** Ends the toggle's accessible name: "+3 more countries". */
  about: string;
  lines?: number;
  className?: string;
}

/**
 * Names as comma-separated text kept to `lines` lines: as many whole names as
 * fit, then "+N more". A name is never cut with an ellipsis; one name is
 * always shown.
 */
export function FoldedNameList({
  items,
  about,
  lines = 2,
  className,
}: FoldedNameListProps) {
  const values = presentValues(items);
  const measure = useRef<HTMLParagraphElement>(null);
  const [count, setCount] = useState(values.length);
  const [expanded, setExpanded] = useState(false);
  const key = values.join("\n");
  const [listKey, setListKey] = useState(key);
  if (listKey !== key) {
    setListKey(key);
    setExpanded(false);
  }

  useResize(
    measure,
    (node) => {
      const line =
        Number.parseFloat(getComputedStyle(node).lineHeight) || FALLBACK_LINE;
      const fits = (shown: number) => {
        node.textContent = values.slice(0, shown).join(", ");
        if (shown < values.length)
          node.textContent += ` +${values.length - shown} more`;
        return node.scrollHeight <= line * lines + 1;
      };
      let shown = values.length;
      while (shown > 1 && !fits(shown)) shown -= 1;
      node.textContent = "";
      setCount(shown);
    },
    [key, lines],
  );

  if (values.length === 0) return null;
  const folded = count < values.length;

  return (
    <div className={cn("relative min-w-0", className)}>
      <p
        ref={measure}
        aria-hidden="true"
        className="invisible absolute inset-x-0 top-0 font-medium [overflow-wrap:anywhere]"
      />
      <p className="[overflow-wrap:anywhere]">
        {(expanded ? values : values.slice(0, count)).join(", ")}
        {folded && (
          <>
            {" "}
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Show less, ${about}`
                  : `+${values.length - count} more ${about}`
              }
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "rounded-sm font-medium underline underline-offset-4 hover:opacity-80",
                foldToggleClass,
              )}
            >
              {expanded ? "Show less" : `+${values.length - count} more`}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
