"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import DGIcon from "./chat/DGIcon";

const DEFAULT_INTERVAL_MS = 6000;

interface WorkingStatusProps {
  /** Shown one after another; the first one is also announced. */
  messages: readonly [string, ...string[]];
  /** Start over after the last message (default) or stay on it for long waits. */
  repeat?: boolean;
  /** Announced once to screen readers instead of the first message. */
  announcement?: string;
  intervalMs?: number;
  iconSize?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Dots() {
  return (
    <span aria-hidden="true">
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

/**
 * DataGEMS is working on the user's request: the pulsing DataGEMS mark with a
 * status that changes while the wait goes on. Use it wherever the user waits
 * for DataGEMS to classify, search or answer.
 */
export function WorkingStatus({
  messages,
  repeat = true,
  announcement,
  intervalMs = DEFAULT_INTERVAL_MS,
  iconSize = 16,
  className,
}: WorkingStatusProps) {
  const [index, setIndex] = useState(0);
  const last = messages.length - 1;

  useEffect(() => {
    if (last === 0 || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () =>
        setIndex((current) =>
          current < last ? current + 1 : repeat ? 0 : current,
        ),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [last, repeat, intervalMs]);

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <DGIcon
        size={iconSize}
        className="opacity-60 animate-pulse motion-reduce:animate-none shrink-0"
        aria-hidden="true"
      />
      <span role="status" className="sr-only">
        {announcement ?? messages[0]}
      </span>
      <span className="inline-grid" aria-hidden="true">
        {messages.map((message, i) => (
          <span
            key={message}
            data-active={i === index}
            className={cn(
              "col-start-1 row-start-1 text-body-14-regular text-slate-600 whitespace-nowrap transition-opacity duration-300",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            {message}
            <Dots />
          </span>
        ))}
      </span>
    </div>
  );
}
