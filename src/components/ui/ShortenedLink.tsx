"use client";

import { Tooltip } from "@ui/Tooltip";
import { ExternalLink } from "lucide-react";
import { useRef, useState } from "react";
import { cutMiddle, shortUrl } from "@/lib/datasetOverview";
import { cn } from "@/lib/utils";
import { useResize } from "./folding";

/** Width kept for the external-link icon and its gap. */
const ICON_SPACE = 22;

interface ShortenedLinkProps {
  href: string;
  className?: string;
}

/**
 * An external address on one line. A long one loses its middle; the whole
 * address stays in the tooltip and in the link's accessible name.
 */
export function ShortenedLink({ href, className }: ShortenedLinkProps) {
  const text = shortUrl(href);
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);

  useResize(
    box,
    (node) => {
      const ruler = measure.current;
      const width = node.clientWidth - ICON_SPACE;
      if (!ruler || width <= 0) return;
      const cut = cutMiddle(text, (value) => {
        ruler.textContent = value;
        return ruler.scrollWidth <= width;
      });
      ruler.textContent = "";
      setShown(cut);
    },
    [text],
  );

  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${href} (opens in a new tab)`}
      className="relative inline-flex max-w-full items-center gap-1.5 rounded-sm whitespace-nowrap text-gray-750 underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-850 max-lg:after:absolute max-lg:after:-inset-y-2.5 max-lg:after:inset-x-0"
    >
      <span data-shown>{shown}</span>
      <ExternalLink
        aria-hidden="true"
        className="size-3.5 shrink-0 text-icon"
      />
    </a>
  );

  return (
    <span ref={box} className={cn("relative block min-w-0", className)}>
      <span
        ref={measure}
        aria-hidden="true"
        className="invisible absolute top-0 left-0 whitespace-nowrap"
      />
      {shown === text ? (
        link
      ) : (
        <Tooltip content={href} className="max-w-full">
          {link}
        </Tooltip>
      )}
    </span>
  );
}
