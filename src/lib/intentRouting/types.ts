/**
 * Home intent routing — shared types.
 *
 * The Gateway classifier (`POST /search/disambiguate-intent`) returns one of
 * four intents. Only `dataset_search` and `question` lead to a destination;
 * the other two keep the user on Home.
 */

export type Intent =
  | "dataset_search"
  | "question"
  | "ambiguous"
  | "out_of_scope";

export type DestinationIntent = Extract<Intent, "dataset_search" | "question">;

/** A successfully decoded classification. Absent diagnostics are `null`. */
export interface Classification {
  intent: Intent;
  /** Keywords for discovery; `null` when Gateway returned none. */
  retrievalQuery: string | null;
  /** The classifier fell back (model unavailable); never trust `intent`. */
  degraded: boolean;
  confidence: number | null;
  model: string | null;
  promptVersion: string | null;
}

export type DecodeResult<T> = { ok: true; value: T } | { ok: false };

/** Coarse transport/response failure kinds; never carries bodies or text. */
export type ClassificationFailureKind =
  | "auth"
  | "unavailable"
  | "http"
  | "network"
  | "invalid"
  | "aborted";

export type ClassificationOutcome =
  | { ok: true; classification: Classification }
  | { ok: false; kind: ClassificationFailureKind };

/** Data carried from Home to the destination view for one submission. */
export interface IntentHandoff {
  originalQuery: string;
  retrievalQuery: string | null;
  intent: DestinationIntent;
  chosenBy: "classifier" | "user";
}
