"use client";

import { type DependencyList, type RefObject, useLayoutEffect } from "react";

/** Focus ring and touch target shared by the fold toggles. */
export const foldToggleClass =
  "relative cursor-pointer whitespace-nowrap text-gray-750 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-850 max-lg:after:absolute max-lg:after:-inset-2.5";

/**
 * Runs `update` with the node now, whenever the node changes size and once the
 * web fonts are ready, so measurements follow the real layout.
 */
export function useResize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  update: (node: T) => void,
  deps: DependencyList,
) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let active = true;
    const run = () => {
      if (active) update(node);
    };
    run();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(run);
    observer?.observe(node);
    document.fonts?.ready.then(run);
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, deps);
}
