"use client";

import { AIMessageActions } from "@ui/chat/AIMessageActions";
import { AIMessageContent } from "@ui/chat/AIMessageContent";
import { AIMessageHeader } from "@ui/chat/AIMessageHeader";
import { ChatRecommendations } from "@ui/chat/ChatRecommendations";
import DatasetProposalBlock from "@ui/chat/DatasetProposalBlock";
import { TemperatureMap } from "@ui/chat/TemperatureMap";
import { TemperatureAnswer } from "@ui/chat/temperature/TemperatureAnswer";
import { useMemo } from "react";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { interpretTemperatureAnswer } from "@/lib/temperatureAnswer/interpret";
import type { Message } from "@/types/chat";

interface AIMessageProps {
  message: Message;
  onSourcesClick?: () => void;
  onRecommendationClick?: (recommendation: string) => void;
  onDatasetProposalConfirm?: () => void;
  isLastAIMessage?: boolean;
}

export function AIMessage({
  message,
  onSourcesClick,
  onRecommendationClick,
  onDatasetProposalConfirm,
  isLastAIMessage = false,
}: AIMessageProps) {
  const questionRecommendationEnabled = useFeatureFlag(
    "questionRecommendation",
  );
  const datasetRecommendationEnabled = useFeatureFlag("datasetRecommendation");
  const shouldShowRecommendations =
    questionRecommendationEnabled &&
    isLastAIMessage &&
    (message.recommendationsLoading ||
      (message.recommendations && message.recommendations.length > 0));
  // Recognised temperature answers get their own presentation; every other
  // answer keeps the plain table and map below.
  const temperatureAnswer = useMemo(
    () => interpretTemperatureAnswer(message.tableData),
    [message.tableData],
  );

  return (
    <div className="w-full max-w-full space-y-4 shadow-s1 border border-slate-350 rounded-2xl p-4 sm:px-6 sm:py-5">
      <AIMessageHeader />

      {datasetRecommendationEnabled &&
      message.datasetProposal &&
      message.datasetProposal.length > 0 ? (
        <DatasetProposalBlock
          datasets={message.datasetProposal}
          onConfirm={onDatasetProposalConfirm ?? (() => {})}
          isSubmitting={message.datasetProposalSubmitting}
          isResolved={message.datasetProposalResolved}
        />
      ) : (
        <>
          {temperatureAnswer ? (
            <>
              <TemperatureAnswer answer={temperatureAnswer} message={message} />
              <AIMessageContent content="" sqlQuery={message.sqlQuery} />
            </>
          ) : (
            <>
              <TemperatureMap
                content={message.content}
                latitude={message.latitude}
                longitude={message.longitude}
                tableData={message.tableData}
                baseRadius={90}
                heatOpacity={0.55}
                requireTableData={false}
              />
              <AIMessageContent
                content={message.content}
                tableData={message.tableData}
                sqlQuery={message.sqlQuery}
              />
            </>
          )}
          <AIMessageActions
            sources={message.sources}
            onSourcesClick={onSourcesClick}
          />
        </>
      )}

      {shouldShowRecommendations && (
        <ChatRecommendations
          recommendations={message.recommendations}
          onRecommendationClick={onRecommendationClick ?? (() => {})}
          isLoading={message.recommendationsLoading}
        />
      )}
    </div>
  );
}
