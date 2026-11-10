"use client";

import { useEffect, useState } from "react";
import { pickExamples } from "@/lib/homeExamples/pick";
import {
  DATASETS_EXAMPLE_COUNT,
  EXAMPLE_POOL,
  type ExampleQuery,
} from "@/lib/homeExamples/pool";

const NONE: readonly string[] = [];

/**
 * Draws the Datasets example searches once per mount from the pool entries
 * classified as dataset searches; questions belong to Chat. Drawn in an
 * effect so the server render and the first client render agree.
 */
export function useDatasetSearchExamples(
  pool: readonly ExampleQuery[] = EXAMPLE_POOL,
  random: () => number = Math.random,
): readonly string[] {
  const [examples, setExamples] = useState<readonly string[]>(NONE);

  useEffect(() => {
    const searches = pool
      .filter((entry) => entry.intent === "dataset_search")
      .map((entry) => entry.text);
    setExamples(pickExamples(searches, DATASETS_EXAMPLE_COUNT, random));
  }, []);

  return examples;
}
