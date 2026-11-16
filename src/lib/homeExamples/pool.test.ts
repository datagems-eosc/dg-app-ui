import { describe, expect, it } from "vitest";
import { isClassifiableQuery } from "@/lib/intentRouting/gateway";
import {
  DATASETS_EXAMPLE_COUNT,
  EXAMPLE_POOL,
  HOME_EXAMPLE_COUNTS,
} from "./pool";

describe("EXAMPLE_POOL", () => {
  it("holds enough queries to fill the idle and out-of-scope sets without repeats", () => {
    expect(EXAMPLE_POOL.length).toBeGreaterThanOrEqual(
      HOME_EXAMPLE_COUNTS.idle + HOME_EXAMPLE_COUNTS.outOfScope,
    );
  });

  it("holds enough dataset searches to fill the Datasets examples without repeats", () => {
    const searches = EXAMPLE_POOL.filter(
      (entry) => entry.intent === "dataset_search",
    );
    expect(searches.length).toBeGreaterThanOrEqual(DATASETS_EXAMPLE_COUNT);
  });

  it("contains only unique queries the classifier accepts", () => {
    const texts = EXAMPLE_POOL.map((entry) => entry.text.trim().toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
    for (const entry of EXAMPLE_POOL) {
      expect(isClassifiableQuery(entry.text)).toBe(true);
    }
  });
});
