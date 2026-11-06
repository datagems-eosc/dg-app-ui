import { describe, expect, it } from "vitest";
import { routeClassification } from "./routing";
import type { Classification, Intent } from "./types";

const classification = (intent: Intent, degraded = false): Classification => ({
  intent,
  degraded,
  retrievalQuery: null,
  confidence: null,
  model: null,
  promptVersion: null,
});

describe("routeClassification", () => {
  it.each([
    ["dataset_search", { kind: "navigate", intent: "dataset_search" }],
    ["question", { kind: "navigate", intent: "question" }],
    ["ambiguous", { kind: "clarify", degraded: false }],
    ["out_of_scope", { kind: "outOfScope" }],
  ] as const)("routes %s", (intent, expected) => {
    expect(routeClassification(classification(intent))).toEqual(expected);
  });

  it.each(["dataset_search", "question", "ambiguous", "out_of_scope"] as const)(
    "asks the user when a %s result is degraded",
    (intent) => {
      expect(routeClassification(classification(intent, true))).toEqual({
        kind: "clarify",
        degraded: true,
      });
    },
  );
});
