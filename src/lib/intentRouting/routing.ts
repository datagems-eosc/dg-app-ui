import type { Classification, DestinationIntent } from "./types";

export type HomeRoute =
  | { kind: "navigate"; intent: DestinationIntent }
  | { kind: "clarify"; degraded: boolean }
  | { kind: "outOfScope" };

/**
 * Decide what Home does with a classification. A degraded result means the
 * classifier fell back, so its intent is never acted on automatically.
 */
export function routeClassification(classification: Classification): HomeRoute {
  if (classification.degraded) return { kind: "clarify", degraded: true };
  switch (classification.intent) {
    case "dataset_search":
    case "question":
      return { kind: "navigate", intent: classification.intent };
    case "ambiguous":
      return { kind: "clarify", degraded: false };
    case "out_of_scope":
      return { kind: "outOfScope" };
  }
}
