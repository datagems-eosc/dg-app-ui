/**
 * Language pilot — aggregation of a parsed linguistic-features result into the
 * Analysis Workspace panels. Each panel is empty on its own: the feature panels
 * depend on `features`, Retrieved Texts on the RAG passages.
 */

import type { LinguisticFeaturesResult } from "./parse";

export interface TermFreqRow {
  token: string;
  frequency: number;
}

export interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  avgSentiment: number;
  confidence: number;
  totalDocs: number;
}

export interface CollocationRow {
  bigram: string;
  frequency: number;
  pmi: number;
}

export interface RetrievedTextRow {
  content: string;
}

export interface AnalysisPanels {
  termFreqData: TermFreqRow[];
  sentimentData: SentimentData | null;
  collocationData: CollocationRow[];
  retrievedTexts: RetrievedTextRow[];
}

export function toAnalysisPanels({
  features,
  passages,
}: LinguisticFeaturesResult): AnalysisPanels {
  // Aggregate term frequency — sum counts across all feature chunks, sort by count desc
  const termCounts = new Map<string, number>();
  for (const feature of features) {
    for (const item of Array.isArray(feature.term_frequency)
      ? feature.term_frequency
      : []) {
      const term = String(item?.term ?? "").trim();
      if (!term) continue;
      termCounts.set(
        term,
        (termCounts.get(term) ?? 0) + Number(item.count ?? 0),
      );
    }
  }
  const termFreqData: TermFreqRow[] = Array.from(termCounts.entries())
    .map(([token, frequency]) => ({ token, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);

  // Aggregate sentiment — sum term counts, average polarity/subjectivity scores.
  // Empty when no chunk carries a profile (the Gateway omits null profiles).
  let sentimentData: SentimentData | null = null;
  if (features.some((feature) => feature.sentiment_profile)) {
    let posTerms = 0;
    let negTerms = 0;
    let neutTerms = 0;
    let totalTerms = 0;
    let polaritySum = 0;
    let subjectivitySum = 0;
    for (const feature of features) {
      const sp = feature.sentiment_profile ?? {};
      posTerms += Number(sp.positive_terms ?? 0);
      negTerms += Number(sp.negative_terms ?? 0);
      neutTerms += Number(sp.neutral_terms ?? 0);
      totalTerms += Number(sp.total_terms ?? 0);
      polaritySum += Number(sp.polarity_score ?? 0);
      subjectivitySum += Number(sp.subjectivity_score ?? 0);
    }
    const denom = totalTerms || 1;
    sentimentData = {
      positive: (posTerms / denom) * 100,
      neutral: (neutTerms / denom) * 100,
      negative: (negTerms / denom) * 100,
      avgSentiment: polaritySum / features.length,
      confidence: subjectivitySum / features.length,
      totalDocs: features.length,
    };
  }

  // Aggregate collocations — join terms[] to bigram, sum counts, take max association_score
  const colMap = new Map<string, { count: number; score: number }>();
  for (const feature of features) {
    for (const col of Array.isArray(feature.collocations)
      ? feature.collocations
      : []) {
      const terms: string[] = Array.isArray(col?.terms) ? col.terms : [];
      const bigram = terms.join(" ");
      if (!bigram) continue;
      const existing = colMap.get(bigram);
      if (existing) {
        existing.count += Number(col.count ?? 0);
        existing.score = Math.max(
          existing.score,
          Number(col.association_score ?? 0),
        );
      } else {
        colMap.set(bigram, {
          count: Number(col.count ?? 0),
          score: Number(col.association_score ?? 0),
        });
      }
    }
  }
  const collocationData: CollocationRow[] = Array.from(colMap.entries())
    .map(([bigram, { count, score }]) => ({
      bigram,
      frequency: count,
      pmi: score,
    }))
    .sort((a, b) => b.pmi - a.pmi)
    .slice(0, 20);

  const retrievedTexts: RetrievedTextRow[] = passages
    .filter((passage) => typeof passage.content === "string")
    .sort((a, b) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0))
    .slice(0, 10)
    .map((passage) => ({ content: String(passage.content) }));

  return { termFreqData, sentimentData, collocationData, retrievedTexts };
}
