"use client";

import { useEffect, useState } from "react";
import { pickExamples } from "@/lib/homeExamples/pick";
import {
  EXAMPLE_POOL,
  type ExampleQuery,
  HOME_EXAMPLE_COUNTS,
} from "@/lib/homeExamples/pool";
import type { HomeExamples } from "./HomeQueryEntry";

const NONE: HomeExamples = { idle: [], outOfScope: [] };

/**
 * Draws the Home example queries once per mount: the first picks go to the
 * idle entry, the next ones to the out-of-scope panel, so no query appears in
 * both. The draw runs in an effect so the server render and the first client
 * render agree (no examples), and the selection stays fixed for the visit.
 */
export function useHomeExamples(
  pool: readonly ExampleQuery[] = EXAMPLE_POOL,
  random: () => number = Math.random,
): HomeExamples {
  const [examples, setExamples] = useState<HomeExamples>(NONE);

  useEffect(() => {
    const { idle, outOfScope } = HOME_EXAMPLE_COUNTS;
    const texts = pickExamples(
      pool.map((entry) => entry.text),
      idle + outOfScope,
      random,
    );
    setExamples({ idle: texts.slice(0, idle), outOfScope: texts.slice(idle) });
  }, []);

  return examples;
}
