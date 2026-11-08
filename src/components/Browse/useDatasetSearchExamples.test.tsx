import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ExampleQuery } from "@/lib/homeExamples/pool";
import { useDatasetSearchExamples } from "./useDatasetSearchExamples";

const POOL: ExampleQuery[] = [
  { text: "rainfall datasets", intent: "dataset_search" },
  { text: "How hot was Athens?", intent: "question" },
  { text: "Greek corpora", intent: "dataset_search" },
  { text: "Which month was wettest?", intent: "question" },
  { text: "algebra resources", intent: "dataset_search" },
  { text: "course enrolments", intent: "dataset_search" },
  { text: "parliament speeches", intent: "dataset_search" },
];

describe("useDatasetSearchExamples", () => {
  it("draws four examples from the dataset searches only", () => {
    const { result } = renderHook(() => useDatasetSearchExamples(POOL));
    expect(result.current).toHaveLength(4);
    const searches = POOL.filter((e) => e.intent === "dataset_search").map(
      (e) => e.text,
    );
    for (const text of result.current) expect(searches).toContain(text);
  });

  it("keeps the same selection across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      useDatasetSearchExamples(POOL),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("uses the given randomness", () => {
    const { result } = renderHook(() =>
      useDatasetSearchExamples(POOL, () => 0),
    );
    expect(result.current).toEqual([
      "rainfall datasets",
      "Greek corpora",
      "algebra resources",
      "course enrolments",
    ]);
  });
});
