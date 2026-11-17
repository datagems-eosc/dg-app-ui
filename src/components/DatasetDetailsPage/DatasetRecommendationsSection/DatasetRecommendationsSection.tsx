"use client";

import { Chip } from "@ui/Chip";
import FormattedText from "@ui/FormattedText";
import { Notice } from "@ui/Notice";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDisplayCollectionLabel } from "@/config/collectionConstants";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { mapApiDatasetToDataset } from "@/lib/datasetMapping";
import type { DatasetRecommendationsResult } from "@/lib/datasetRecommendations";
import { getNavigationUrl } from "@/lib/utils";
import styles from "./DatasetRecommendationsSection.module.scss";
import DatasetRecommendationsSkeleton from "./DatasetRecommendationsSkeleton";

// Proposed wording; accepted in the PR.
const NOTES: Record<
  Exclude<DatasetRecommendationsResult["status"], "datasets">,
  string
> = {
  none: "No similar datasets found.",
  noAccess: "Recommendations are shown only for datasets you have access to.",
  failed: "Recommendations are not available for this dataset right now.",
};

interface DatasetRecommendationsSectionProps {
  datasetId: string;
}

export default function DatasetRecommendationsSection({
  datasetId,
}: DatasetRecommendationsSectionProps) {
  const router = useRouter();
  const { getDatasetRecommendations } = useApi();
  // Kept with the dataset it answers, so an answer never shows on another
  // dataset's page.
  const [answer, setAnswer] = useState<{
    datasetId: string;
    result: DatasetRecommendationsResult;
  } | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    getDatasetRecommendations(datasetId).then((result) => {
      if (!cancelled) setAnswer({ datasetId, result });
    });
    return () => {
      cancelled = true;
    };
  }, [datasetId, getDatasetRecommendations]);

  const handleCardClick = (dataset: DatasetPlus) => {
    router.push(getNavigationUrl(`/datasets/${dataset.id}`));
  };

  const result = answer?.datasetId === datasetId ? answer.result : null;
  if (result === null) return <DatasetRecommendationsSkeleton />;

  return (
    <div className={styles.datasetRecommendationsSection}>
      <h3 className={styles.datasetRecommendationsSection__title}>
        Recommended datasets
      </h3>
      {result.status === "datasets" ? (
        <RecommendationGrid
          recommendations={result.datasets.map(mapApiDatasetToDataset)}
          onOpen={handleCardClick}
        />
      ) : (
        <Notice tone="neutral" title={NOTES[result.status]} />
      )}
    </div>
  );
}

function RecommendationGrid({
  recommendations,
  onOpen,
}: {
  recommendations: DatasetPlus[];
  onOpen: (dataset: DatasetPlus) => void;
}) {
  return (
    <div className={styles.datasetRecommendationsSection__grid}>
      {recommendations.map((dataset) => {
        const collectionLabel = getDisplayCollectionLabel(dataset.collections);
        return (
          <div
            key={dataset.id}
            className={styles.datasetRecommendationsSection__card}
            onClick={() => onOpen(dataset)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(dataset);
              }
            }}
            aria-label={`View details for ${dataset.title}`}
          >
            <div className={styles.datasetRecommendationsSection__cardContent}>
              <div className={styles.datasetRecommendationsSection__cardHeader}>
                <h4 className={styles.datasetRecommendationsSection__cardTitle}>
                  {dataset.title}
                </h4>
                {/*
                  Always rendered, so descriptions in one row start at the same
                  height. No access chip: recommendations carry no publication
                  evidence (PM-01 F1).
                */}
                <div
                  data-testid="recommendation-chips"
                  className={styles.datasetRecommendationsSection__cardChips}
                >
                  {collectionLabel && (
                    <Chip color="grey" size="sm" className="min-w-0">
                      <span className="truncate">{collectionLabel}</span>
                    </Chip>
                  )}
                  {dataset.license && (
                    <Chip color="success" size="sm" className="min-w-0">
                      <span className="truncate">{dataset.license}</span>
                    </Chip>
                  )}
                </div>
              </div>
              <FormattedText
                as="p"
                className={
                  styles.datasetRecommendationsSection__cardDescription
                }
                text={dataset.description || ""}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
