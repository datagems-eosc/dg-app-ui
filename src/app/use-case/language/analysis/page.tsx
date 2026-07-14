"use client";

import { ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface TermFreqRow {
  token: string;
  frequency: number;
}

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  avgSentiment: number;
  confidence: number;
  totalDocs: number;
}

interface CollocationRow {
  bigram: string;
  frequency: number;
  pmi: number;
}

interface RetrievedTextRow {
  content: string;
}

interface AnalysisState {
  query: string;
  features: {
    termFrequency: boolean;
    sentimentProfile: boolean;
    collocations: boolean;
  };
  termFreqData: TermFreqRow[];
  sentimentData: SentimentData | null;
  collocationData: CollocationRow[];
  retrievedTexts: RetrievedTextRow[];
}

function mapResponse(
  raw: any,
): Pick<
  AnalysisState,
  "termFreqData" | "sentimentData" | "collocationData" | "retrievedTexts"
> {
  const features: any[] = Array.isArray(raw?.features) ? raw.features : [];
  if (features.length === 0) {
    return {
      termFreqData: [],
      sentimentData: null,
      collocationData: [],
      retrievedTexts: [],
    };
  }

  // Aggregate term frequency — sum counts across all feature chunks, sort by count desc
  const termCounts = new Map<string, number>();
  for (const feature of features) {
    for (const item of Array.isArray(feature.term_frequency)
      ? feature.term_frequency
      : []) {
      const term = String(item.term ?? "").trim();
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

  // Aggregate sentiment — sum term counts, average polarity/subjectivity scores
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
  const sentimentData: SentimentData = {
    positive: (posTerms / denom) * 100,
    neutral: (neutTerms / denom) * 100,
    negative: (negTerms / denom) * 100,
    avgSentiment: polaritySum / features.length,
    confidence: subjectivitySum / features.length,
    totalDocs: features.length,
  };

  // Aggregate collocations — join terms[] to bigram, sum counts, take max association_score
  const colMap = new Map<string, { count: number; score: number }>();
  for (const feature of features) {
    for (const col of Array.isArray(feature.collocations)
      ? feature.collocations
      : []) {
      const terms: string[] = Array.isArray(col.terms) ? col.terms : [];
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

  const ragResults: any[] = Array.isArray(raw?.rag_output?.results)
    ? raw.rag_output.results
    : [];
  const retrievedTexts: RetrievedTextRow[] = ragResults
    .filter((r) => typeof r?.content === "string")
    .sort((a, b) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0))
    .slice(0, 10)
    .map((r) => ({
      content: String(r.content),
    }));

  return { termFreqData, sentimentData, collocationData, retrievedTexts };
}

function DonutChart({ data }: { data: SentimentData }) {
  const total = data.positive + data.neutral + data.negative || 1;
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: data.positive, color: "#2b7fff" },
    { value: data.neutral, color: "#94a3b8" },
    { value: data.negative, color: "#f54900" },
  ];

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const offset = (1 - cumulative / total) * circumference;
    const dasharray = (seg.value / total) * circumference;
    cumulative += seg.value;
    return { ...seg, offset, dasharray };
  });

  const dominantPct = Math.round((data.positive / total) * 100);

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="24"
          strokeDasharray={`${arc.dasharray} ${circumference - arc.dasharray}`}
          strokeDashoffset={arc.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={48} fill="white" />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="18"
        fontWeight="600"
        fill="#314158"
      >
        {dominantPct}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#5b708f">
        Positive
      </text>
    </svg>
  );
}

export default function LanguageAnalysisPage() {
  const router = useRouter();
  const [state, setState] = useState<AnalysisState | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("language_analysis");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const mapped = mapResponse(parsed.result ?? {});
      setState({
        query: parsed.query ?? "",
        features: parsed.features ?? {
          termFrequency: true,
          sentimentProfile: true,
          collocations: true,
        },
        ...mapped,
      });
    } catch {
      // ignore parse errors
    }
  }, []);

  const showTermFreq = state?.features.termFrequency ?? true;
  const showSentiment = state?.features.sentimentProfile ?? true;
  const showCollocations = state?.features.collocations ?? true;

  const termFreqData = state?.termFreqData ?? [];
  const sentimentData = state?.sentimentData ?? null;
  const collocationData = state?.collocationData ?? [];
  const retrievedTexts = state?.retrievedTexts ?? [];

  return (
    <div className="flex justify-center px-5 py-10">
      <div className="flex flex-col gap-8 w-full max-w-[900px]">
        {/* Top nav */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 bg-white border border-[#cad5e2] text-[#314158] text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center bg-white border border-[#cad5e2] text-[#314158] w-10 h-10 rounded-[40px] shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)]"
          >
            <Download size={16} />
          </button>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-semibold text-[#314158] leading-[1.4]">
            Analysis Workspace
          </h1>
          {state?.query && (
            <p className="text-[20px] font-normal text-[#5b708f] leading-[1.4]">
              {state.query}
            </p>
          )}
          {!state?.query && (
            <p className="text-[20px] font-normal text-[#5b708f] leading-[1.4]">
              Feature extraction, concept tracking and document grouping
            </p>
          )}
        </div>

        {/* Term Frequency */}
        {showTermFreq && termFreqData.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-[20px] font-semibold text-[#1d293d] leading-[1.4]">
                Term Frequency
              </h2>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Most frequent tokens across selected documents
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0]">
                  <th className="text-left text-[12px] font-medium text-[#8095ad] pb-3 w-10">
                    #
                  </th>
                  <th className="text-left text-[12px] font-medium text-[#8095ad] pb-3">
                    Token
                  </th>
                  <th className="text-right text-[12px] font-medium text-[#8095ad] pb-3">
                    Frequency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {termFreqData.map((row, i) => (
                  <tr key={row.token}>
                    <td className="py-3 text-[14px] text-[#8095ad]">{i + 1}</td>
                    <td className="py-3 text-[14px] font-medium text-[#314158]">
                      {row.token}
                    </td>
                    <td className="py-3 text-[14px] text-[#314158] text-right">
                      {row.frequency.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sentiment Profile */}
        {showSentiment && sentimentData && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[20px] font-semibold text-[#1d293d] leading-[1.4] flex-1">
                Sentiment Profile
              </h2>
              {sentimentData.totalDocs > 0 && (
                <span className="inline-flex items-center px-3 h-6 rounded-full bg-[#f1f5f9] text-[12px] font-medium text-[#5b708f]">
                  {sentimentData.totalDocs.toLocaleString()} docs
                </span>
              )}
            </div>
            <div className="flex items-center gap-8">
              <DonutChart data={sentimentData} />
              <div className="flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#2b7fff] shrink-0" />
                  <span className="flex-1 text-[14px] text-[#314158]">
                    Positive
                  </span>
                  <span className="text-[14px] font-medium text-[#314158]">
                    {Math.round(sentimentData.positive)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#94a3b8] shrink-0" />
                  <span className="flex-1 text-[14px] text-[#314158]">
                    Neutral
                  </span>
                  <span className="text-[14px] font-medium text-[#314158]">
                    {Math.round(sentimentData.neutral)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#f54900] shrink-0" />
                  <span className="flex-1 text-[14px] text-[#314158]">
                    Negative
                  </span>
                  <span className="text-[14px] font-medium text-[#314158]">
                    {Math.round(sentimentData.negative)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[24px] font-semibold text-[#314158]">
                    {sentimentData.avgSentiment >= 0 ? "+" : ""}
                    {sentimentData.avgSentiment.toFixed(3)}
                  </span>
                  <span className="text-[12px] font-normal text-[#5b708f]">
                    avg sentiment
                  </span>
                </div>
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[24px] font-semibold text-[#314158]">
                    {sentimentData.confidence.toFixed(3)}
                  </span>
                  <span className="text-[12px] font-normal text-[#5b708f]">
                    confidence score
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collocations */}
        {showCollocations && collocationData.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-[20px] font-semibold text-[#1d293d] leading-[1.4]">
                Collocations
              </h2>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Statistically significant word pairs by pointwise mutual
                information
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0]">
                  <th className="text-left text-[12px] font-medium text-[#8095ad] pb-3 w-10">
                    #
                  </th>
                  <th className="text-left text-[12px] font-medium text-[#8095ad] pb-3">
                    Bigram
                  </th>
                  <th className="text-right text-[12px] font-medium text-[#8095ad] pb-3">
                    Frequency
                  </th>
                  <th className="text-right text-[12px] font-medium text-[#8095ad] pb-3">
                    PMI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {collocationData.map((row, i) => (
                  <tr key={row.bigram}>
                    <td className="py-3 text-[14px] text-[#8095ad]">{i + 1}</td>
                    <td className="py-3 text-[14px] font-medium text-[#314158]">
                      {row.bigram}
                    </td>
                    <td className="py-3 text-[14px] text-[#314158] text-right">
                      {row.frequency}
                    </td>
                    <td className="py-3 text-[14px] text-[#314158] text-right">
                      {row.pmi.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Retrieved Texts */}
        {retrievedTexts.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-[20px] font-semibold text-[#1d293d] leading-[1.4]">
                Retrieved Texts
              </h2>
              <p className="text-[14px] font-normal text-[#5b708f] leading-[1.5]">
                Shows the top 10 texts retrieved based on their similarity to
                the user&apos;s question. The total number of retrieved
                documents may be higher, and the features above were calculated
                using all retrieved documents.
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0]">
                  <th className="text-left text-[12px] font-medium text-[#8095ad] pb-3 w-10">
                    #
                  </th>
                  <th className="text-left text-[12px] font-medium text-[#8095ad] pb-3">
                    Text
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {retrievedTexts.map((row, i) => (
                  <tr key={i}>
                    <td className="py-3 text-[14px] text-[#8095ad] align-top">
                      {i + 1}
                    </td>
                    <td className="py-3 text-[14px] font-medium text-[#314158]">
                      {row.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state when no data and no features selected */}
        {state &&
          !termFreqData.length &&
          !sentimentData &&
          !collocationData.length &&
          !retrievedTexts.length && (
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-10 flex flex-col items-center gap-2">
              <p className="text-[16px] font-medium text-[#314158]">
                No analysis data available
              </p>
              <p className="text-[14px] text-[#5b708f]">
                Try enabling analysis components or selecting datasets with more
                data.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
