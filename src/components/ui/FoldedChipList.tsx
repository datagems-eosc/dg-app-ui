"use client";

import { Chip } from "@ui/Chip";
import { Tooltip } from "@ui/Tooltip";
import { useRef, useState } from "react";
import { chipsThatFit, presentValues } from "@/lib/datasetOverview";
import { cn } from "@/lib/utils";
import { foldToggleClass, useResize } from "./folding";

/** One line, never a broken pill; a cut chip shows its whole text on hover. */
function LineChip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useResize(ref, (node) => setCut(node.scrollWidth > node.clientWidth), [text]);
  const chip = (
    <Chip color="grey" size="xs" className="max-w-full min-w-0">
      <span ref={ref} className="truncate">
        {text}
      </span>
    </Chip>
  );
  return cut ? (
    <Tooltip content={text} className="flex max-w-full min-w-0">
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

interface FoldedChipListProps {
  items: readonly string[];
  /** Names the list and, unless `about` is given, ends the toggle's name. */
  label: string;
  /** Ends the toggle's name: "+3 more permissions". */
  about?: string;
  /** Lines shown before "+N more". */
  lines?: number;
  className?: string;
}

/**
 * Chips kept to whole items on `lines` lines, then "+N more", which expands
 * and collapses the list. Blank and repeated items are dropped.
 */
export function FoldedChipList({
  items,
  label,
  about = label.toLowerCase(),
  lines = 2,
  className,
}: FoldedChipListProps) {
  const values = presentValues(items);
  const measure = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(values.length);
  const [expanded, setExpanded] = useState(false);
  const key = values.join("\n");

  useResize(
    measure,
    (node) => {
      const width = node.clientWidth;
      if (width <= 0) return;
      setCount(
        chipsThatFit(
          [...node.children].map((chip) =>
            Math.min(chip.getBoundingClientRect().width, width),
          ),
          width,
          lines,
        ),
      );
    },
    [key, lines],
  );

  // A new list starts folded.
  const [listKey, setListKey] = useState(key);
  if (listKey !== key) {
    setListKey(key);
    setExpanded(false);
  }

  if (values.length === 0) return null;
  const folded = count < values.length;
  const shown = expanded ? values : values.slice(0, count);

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={measure}
        aria-hidden="true"
        inert
        className="invisible absolute inset-x-0 flex h-0 overflow-hidden"
      >
        {values.map((item) => (
          <span key={item} className="shrink-0">
            {/* The text comes from CSS, so the copy adds nothing to find or read. */}
            <Chip color="grey" size="xs" className="whitespace-nowrap">
              <span
                data-measure-text={item}
                className="after:content-[attr(data-measure-text)]"
              />
            </Chip>
          </span>
        ))}
      </div>
      <ul aria-label={label} className="flex flex-wrap gap-1.5 leading-none">
        {shown.map((item) => (
          <li key={item} className="flex max-w-full min-w-0">
            <LineChip text={item} />
          </li>
        ))}
        {folded && (
          <li className="flex">
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
                "inline-flex h-6 items-center rounded-full border border-slate-300 bg-white px-2 text-xs font-medium hover:bg-slate-75",
                foldToggleClass,
              )}
            >
              {expanded ? "Show less" : `+${values.length - count} more`}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
