import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ExampleQuery } from "@/lib/homeExamples/pool";
import { useHomeExamples } from "./useHomeExamples";

const entry = (text: string): ExampleQuery => ({ text, intent: "question" });
const POOL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"].map(entry);

describe("useHomeExamples", () => {
  it("picks four idle and three different out-of-scope examples from the pool", () => {
    const { result } = renderHook(() => useHomeExamples(POOL));
    const { idle, outOfScope } = result.current;

    expect(idle).toHaveLength(4);
    expect(outOfScope).toHaveLength(3);
    const all = [...idle, ...outOfScope];
    expect(new Set(all).size).toBe(7);
    for (const text of all) expect(POOL.map((e) => e.text)).toContain(text);
  });

  it("keeps the same selection across re-renders of one visit", () => {
    const { result, rerender } = renderHook(() => useHomeExamples(POOL));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("uses the given randomness", () => {
    const { result } = renderHook(() => useHomeExamples(POOL, () => 0));
    expect(result.current).toEqual({
      idle: ["q1", "q2", "q3", "q4"],
      outOfScope: ["q5", "q6", "q7"],
    });
  });

  it("shows every query once when the pool is small", () => {
    const small = ["a", "b", "c", "d", "e"].map(entry);
    const { result } = renderHook(() => useHomeExamples(small, () => 0));
    expect(result.current).toEqual({
      idle: ["a", "b", "c", "d"],
      outOfScope: ["e"],
    });
  });

  it("shows no examples for an empty pool", () => {
    const { result } = renderHook(() => useHomeExamples([]));
    expect(result.current).toEqual({ idle: [], outOfScope: [] });
  });
});
