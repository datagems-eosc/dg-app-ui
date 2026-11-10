/**
 * Language pilot — pure reader for the `POST /pilot/language/linguistic-features`
 * response (`dg-app-api` `LanguagePilot.cs`).
 *
 * Since dg-app-api #80 the Gateway wraps the analysis as
 * `{ result: { rag_output, features, used_chunks }, conversationId }`.
 * The bare form (no `result` wrapper) is still accepted for an older Gateway.
 */

export interface TermFrequencyEntry {
  term?: string;
  frequency?: number;
  count?: number;
}

export interface SentimentProfile {
  label?: string;
  positive_terms?: number;
  negative_terms?: number;
  neutral_terms?: number;
  total_terms?: number;
  polarity_score?: number;
  subjectivity_score?: number;
}

export interface Collocation {
  terms?: string[];
  count?: number;
  association_score?: number;
}

/** One analysed chunk (`LanguagePilotResponse.Metric`). */
export interface FeatureMetric {
  dataset_id?: string;
  object_id?: string;
  similarity?: number;
  term_frequency?: TermFrequencyEntry[] | null;
  sentiment_profile?: SentimentProfile | null;
  collocations?: Collocation[] | null;
}

/** One retrieved passage (`CorpusAnalysisResponse.Result`). */
export interface RetrievedPassage {
  content?: string;
  dataset_id?: string;
  object_id?: string;
  similarity?: number;
  metadata?: Record<string, unknown> | null;
}

export interface LinguisticFeaturesResult {
  features: FeatureMetric[];
  passages: RetrievedPassage[];
  /** Returned by the Gateway; kept for later use, never displayed. */
  conversationId: string | null;
}

/**
 * Safe description of a response the reader could not use. Only keys from the
 * Gateway schema are named; any other key is counted, never named, because a
 * drifted response could carry corpus terms or identifiers as keys.
 */
export interface UnrecognizedDiagnostic {
  keys: string[];
  unknownKeyCount: number;
  valueType: string;
}

export type LinguisticFeaturesOutcome =
  | { kind: "ok"; result: LinguisticFeaturesResult }
  | { kind: "unrecognized"; diagnostic: UnrecognizedDiagnostic };

/** `LanguagePilotResponse` fields. */
const PAYLOAD_KEYS = ["features", "rag_output", "used_chunks"];
/** `SearchResult` fields plus the bare payload fields. */
const TOP_LEVEL_KEYS = ["result", "conversationId", ...PAYLOAD_KEYS];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `null` or absent: the Gateway omits null fields (`NullValueHandling.Ignore`); explicit `null` is accepted defensively. */
const isAbsent = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

/** A list of objects, or empty when absent; `undefined` signals the wrong type. */
const recordsOrEmpty = (
  value: unknown,
): Record<string, unknown>[] | undefined => {
  if (isAbsent(value)) return [];
  return Array.isArray(value) && value.every(isRecord) ? value : undefined;
};

const valueTypeOf = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

/** Diagnostic for a stored entry that is not valid JSON. */
export const INVALID_JSON_DIAGNOSTIC: UnrecognizedDiagnostic = {
  keys: [],
  unknownKeyCount: 0,
  valueType: "invalid-json",
};

const diagnose = (raw: unknown): UnrecognizedDiagnostic => {
  if (!isRecord(raw)) {
    return { keys: [], unknownKeyCount: 0, valueType: valueTypeOf(raw) };
  }
  const keys: string[] = [];
  let unknownKeyCount = 0;
  const collect = (
    record: Record<string, unknown>,
    known: string[],
    prefix: string,
  ) => {
    for (const key of Object.keys(record)) {
      if (known.includes(key)) keys.push(`${prefix}${key}`);
      else unknownKeyCount += 1;
    }
  };
  collect(raw, TOP_LEVEL_KEYS, "");
  if (isRecord(raw.result)) collect(raw.result, PAYLOAD_KEYS, "result.");
  return { keys: keys.sort(), unknownKeyCount, valueType: "object" };
};

/**
 * A payload is recognized when it is empty or carries a `LanguagePilotResponse`
 * field. Empty counts because the Gateway omits null fields, so an analysis with
 * nothing in it arrives as `{}`; an object with only foreign keys is a different
 * contract and must not pass as "no results".
 */
const isAnalysisPayload = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);
  return keys.length === 0 || keys.some((key) => PAYLOAD_KEYS.includes(key));
};

/** The analysis payload: the envelope's `result`, or the bare object. */
const payloadOf = (
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const payload = "result" in raw ? raw.result : raw;
  return isRecord(payload) && isAnalysisPayload(payload) ? payload : undefined;
};

export function parseLinguisticFeatures(
  raw: unknown,
): LinguisticFeaturesOutcome {
  const unrecognized = (): LinguisticFeaturesOutcome => ({
    kind: "unrecognized",
    diagnostic: diagnose(raw),
  });

  if (!isRecord(raw)) return unrecognized();
  const payload = payloadOf(raw);
  if (!payload) return unrecognized();

  const ragOutput = payload.rag_output;
  if (!isAbsent(ragOutput) && !isRecord(ragOutput)) return unrecognized();
  const features = recordsOrEmpty(payload.features);
  const passages = recordsOrEmpty(ragOutput?.results);
  if (!features || !passages) return unrecognized();

  return {
    kind: "ok",
    result: {
      features: features as FeatureMetric[],
      passages: passages as RetrievedPassage[],
      conversationId:
        typeof raw.conversationId === "string" ? raw.conversationId : null,
    },
  };
}
