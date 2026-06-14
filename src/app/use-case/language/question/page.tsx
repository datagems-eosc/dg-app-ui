"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DGIcon from "@/components/ui/chat/DGIcon";
import { useApi } from "@/hooks/useApi";

// Set to a specific dataset ID to restrict analysis to that dataset,
// or null to use all datasets from the language collection.
const PINNED_DATASET_ID: string | null = "d84d1a2e-127d-4393-91d0-afb7e4fd9c68";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center p-[2px] w-[28px] h-[16px] rounded-full transition-colors shrink-0 ${
        checked ? "bg-[#052f4a] justify-end" : "bg-[#e2e8f0] justify-start"
      }`}
    >
      <span className="w-[12px] h-[12px] bg-white rounded-full shadow-[0px_0.6px_0.6px_0px_rgba(213,218,227,0.3)]" />
    </button>
  );
}

export default function LanguageQuestionPage() {
  const router = useRouter();
  const api = useApi();
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [phase, setPhase] = useState<"input" | "analysis">("input");
  const [termFrequency, setTermFrequency] = useState(true);
  const [sentimentProfile, setSentimentProfile] = useState(true);
  const [collocations, setCollocations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!question.trim()) return;
    setSubmittedQuestion(question.trim());
    setPhase("analysis");
  };

  const fetchLanguageDatasetIds = async (): Promise<string[]> => {
    const data = await api.queryDatasets({
      project: { fields: ["id", "collections.id", "collections.name"] },
      page: { Offset: 0, Size: 100 },
      Order: { Items: ["+code"] },
      Metadata: { CountAll: true },
    });
    const items: unknown[] = Array.isArray(data.items) ? data.items : [];
    return items
      .filter(
        (d): d is Record<string, unknown> =>
          typeof d === "object" && d !== null,
      )
      .filter((d) =>
        (Array.isArray(d.collections) ? d.collections : []).some(
          (c: any) =>
            String(c?.name ?? "")
              .toLowerCase()
              .trim() === "language",
        ),
      )
      .map((d) => String(d.id))
      .filter(Boolean);
  };

  const handleStartAnalysis = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const datasetIds = PINNED_DATASET_ID
        ? [PINNED_DATASET_ID]
        : await fetchLanguageDatasetIds();
      const result = await api.getLinguisticFeatures({
        DatasetIds: datasetIds,
        Query: submittedQuestion,
      });
      sessionStorage.setItem(
        "language_analysis",
        JSON.stringify({
          query: submittedQuestion,
          features: { termFrequency, sentimentProfile, collocations },
          result,
        }),
      );
      router.push("/use-case/language/analysis");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Analysis failed. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  if (phase === "analysis") {
    return (
      <div className="flex items-center justify-center flex-1 px-5 py-10 min-h-[calc(100vh-56px-56px)]">
        <div className="flex flex-col gap-8 items-center w-full max-w-[900px]">
          {/* Header */}
          <div className="flex flex-col gap-2 items-center w-full">
            <DGIcon />
            <h1 className="text-[24px] font-semibold text-[#314158] leading-[1.4] text-center">
              {submittedQuestion}
            </h1>
          </div>

          {/* Analysis components card */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col gap-4 w-full">
            <h2 className="text-[20px] font-semibold text-[#1d293d] leading-[1.4]">
              Select analysis components
            </h2>
            <div className="flex flex-col divide-y divide-[#e2e8f0]">
              <div className="flex items-center gap-4 h-10">
                <span className="flex-1 text-[16px] font-normal text-[#314158] leading-[1.5]">
                  Term frequency
                </span>
                <Toggle
                  checked={termFrequency}
                  onChange={() => setTermFrequency((v) => !v)}
                />
              </div>
              <div className="flex items-center gap-4 h-10">
                <span className="flex-1 text-[16px] font-normal text-[#314158] leading-[1.5]">
                  Sentiment profile
                </span>
                <Toggle
                  checked={sentimentProfile}
                  onChange={() => setSentimentProfile((v) => !v)}
                />
              </div>
              <div className="flex items-center gap-4 h-10">
                <span className="flex-1 text-[16px] font-normal text-[#314158] leading-[1.5]">
                  Collocations
                </span>
                <Toggle
                  checked={collocations}
                  onChange={() => setCollocations((v) => !v)}
                />
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-[14px] text-red-600 text-center">
              {submitError}
            </p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setPhase("input")}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 bg-white border border-[#cad5e2] text-[#314158] text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)] disabled:opacity-50"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 bg-[#052f4a] text-white text-[14px] font-medium leading-[1.5] px-4 h-10 rounded-[40px] shadow-[0px_1px_0.5px_rgba(213,218,227,0.3)] disabled:opacity-70"
            >
              {isSubmitting ? "Analyzing..." : "Start Analysis"}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center flex-1 px-5 min-h-[calc(100vh-56px-56px)]">
      <div className="flex flex-col gap-8 items-center w-full max-w-[900px]">
        {/* Header */}
        <div className="flex flex-col gap-2 items-center text-center">
          <DGIcon />
          <h1 className="text-[32px] font-semibold text-[#314158] leading-[1.4]">
            Start your research
          </h1>
          <p className="text-[20px] font-normal text-[#566b88] leading-[1.4] max-w-[592px]">
            Ask a natural language question to explore linguistic trends and
            concepts across datasets.
          </p>
        </div>

        {/* Input box */}
        <div className="relative bg-white border border-[#e2e8f0] rounded-2xl w-full h-[155px] shadow-[0px_0px_0px_4px_rgba(202,213,226,0.25),0px_5px_8px_0px_rgba(144,156,178,0.1)] overflow-hidden">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full h-full resize-none p-[18px] pr-[60px] text-[16px] font-normal text-[#314158] leading-[1.5] placeholder:text-[#8095ad] outline-none bg-transparent"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="absolute right-[10px] bottom-[10px] bg-[#052f4a] text-white p-2 rounded-[40px] flex items-center justify-center"
          >
            <ArrowUpRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
