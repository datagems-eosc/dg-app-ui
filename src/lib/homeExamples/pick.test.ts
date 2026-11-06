import { describe, expect, it } from "vitest";
import { pickExamples } from "./pick";

const pool = ["a", "b", "c", "d", "e"];

describe("pickExamples", () => {
  it("draws the requested number of distinct entries using the given randomness", () => {
    // random() = 0.99 always swaps in the last remaining entry.
    expect(pickExamples(pool, 3, () => 0.99)).toEqual(["e", "a", "b"]);
  });

  it("returns every entry once when the pool is smaller than the request", () => {
    const picked = pickExamples(pool, 9, () => 0);
    expect(picked).toEqual(pool);
  });

  it.each([0, -2])("returns nothing for a count of %i", (count) => {
    expect(pickExamples(pool, count, () => 0.5)).toEqual([]);
  });

  it("returns nothing for an empty pool", () => {
    expect(pickExamples([], 4)).toEqual([]);
  });

  it("leaves the pool unchanged", () => {
    const copy = [...pool];
    pickExamples(pool, 4, () => 0.7);
    expect(pool).toEqual(copy);
  });

  it("never repeats an entry with the default randomness", () => {
    for (let run = 0; run < 50; run++) {
      const picked = pickExamples(pool, 4);
      expect(new Set(picked).size).toBe(4);
      for (const entry of picked) expect(pool).toContain(entry);
    }
  });
});
