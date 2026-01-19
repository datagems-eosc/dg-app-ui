"use client";

import { Search as SearchIcon } from "lucide-react";
import { Button } from "../Button";
import { RecommendationsSkeleton } from "./RecommendationsSkeleton";

interface ChatRecommendationsProps {
  recommendations?: string[];
  onRecommendationClick: (recommendation: string) => void;
  isLoading?: boolean;
}

export function ChatRecommendations({
  recommendations,
  onRecommendationClick,
  isLoading = false,
}: ChatRecommendationsProps) {
  if (isLoading) {
    return <RecommendationsSkeleton />;
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <p className="text-body-16-semibold text-gray-750 mb-2">
        Would you be also interested in these topics?
      </p>
      <div className="flex flex-wrap gap-2">
        {recommendations.map((recommendation, idx) => (
          <Button
            key={`recommendation-${idx}`}
            variant="tertiary"
            size="smPlus"
            className="!px-3"
            onClick={() => onRecommendationClick(recommendation)}
          >
            <SearchIcon className="w-4 h-4 mr-2" />
            {recommendation}
          </Button>
        ))}
      </div>
    </div>
  );
}
