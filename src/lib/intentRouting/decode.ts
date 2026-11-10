/**
 * Home intent routing — response decoder.
 *
 * Decodes `SearchResult<IntentDisambiguation>` from Gateway `origin/main`
 * `68195367639f27b2d987955e758d28ad67acbade` (source-read, not observed live).
 * Gateway only populates projected fields and leaves the rest at CLR defaults
 * (`Intent = dataset_search`, `Degraded = false`), so a wrong projection name
 * would look like a confident dataset search. The decoder therefore requires
 * `intent` and `degraded` to be present and fails closed on anything else.
 *
 * Enum encoding is unverified: the app model has no string converter, so
 * numbers 0–3 are expected, but the exact names are also accepted.
 */

import type { Classification, DecodeResult, Intent } from "./types";

const INTENT_BY_NUMBER: readonly Intent[] = [
  "dataset_search",
  "question",
  "ambiguous",
  "out_of_scope",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function decodeIntent(raw: unknown): Intent | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) ? (INTENT_BY_NUMBER[raw] ?? null) : null;
  }
  if (typeof raw === "string") {
    return (INTENT_BY_NUMBER as readonly string[]).includes(raw)
      ? (raw as Intent)
      : null;
  }
  return null;
}

const optionalString = (raw: unknown): string | null =>
  typeof raw === "string" ? raw : null;

export function decodeClassification(
  body: unknown,
): DecodeResult<Classification> {
  if (!isRecord(body) || !isRecord(body.result)) return { ok: false };
  const result = body.result;

  const intent = decodeIntent(result.intent);
  if (intent === null || typeof result.degraded !== "boolean") {
    return { ok: false };
  }

  const searchQuery = optionalString(result.searchQuery)?.trim();

  return {
    ok: true,
    value: {
      intent,
      retrievalQuery: searchQuery ? searchQuery : null,
      degraded: result.degraded,
      confidence:
        typeof result.confidence === "number" ? result.confidence : null,
      model: optionalString(result.model),
      promptVersion: optionalString(result.promptVersion),
    },
  };
}
