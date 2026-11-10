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
 * Safe description of a response the reader could not use: key names and the
 * top-level value type only, never values, so no passage or term text leaks
 * into logs.
 */
export interface UnrecognizedDiagnostic {
  keys: string[];
  valueType: string;
}

export type LinguisticFeaturesOutcome =
  | { kind: "ok"; result: LinguisticFeaturesResult }
  | { kind: "unrecognized"; diagnostic: UnrecognizedDiagnostic };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `null` or absent: the Gateway model has no defaults, so empty fields may arrive as `null`. */
const isAbsent = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

/** An array, or empty when absent; `undefined` signals the wrong type. */
const listOrEmpty = (value: unknown): unknown[] | undefined => {
  if (isAbsent(value)) return [];
  return Array.isArray(value) ? value : undefined;
};

const valueTypeOf = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const diagnose = (raw: unknown): UnrecognizedDiagnostic => {
  if (!isRecord(raw)) return { keys: [], valueType: valueTypeOf(raw) };
  const keys = Object.keys(raw);
  if (isRecord(raw.result)) {
    keys.push(...Object.keys(raw.result).map((key) => `result.${key}`));
  }
  return { keys: keys.sort(), valueType: "object" };
};

/** The analysis payload: the `result` of the envelope, or the bare object. */
const payloadOf = (
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if ("result" in raw) return isRecord(raw.result) ? raw.result : undefined;
  return raw;
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
  if (!payload || !("features" in payload || "rag_output" in payload)) {
    return unrecognized();
  }

  const ragOutput = payload.rag_output;
  if (!isAbsent(ragOutput) && !isRecord(ragOutput)) return unrecognized();
  const features = listOrEmpty(payload.features);
  const passages = listOrEmpty(ragOutput?.results);
  if (!features || !passages) return unrecognized();

  return {
    kind: "ok",
    result: {
      features: features.filter(isRecord) as FeatureMetric[],
      passages: passages.filter(isRecord) as RetrievedPassage[],
      conversationId:
        typeof raw.conversationId === "string" ? raw.conversationId : null,
    },
  };
}
