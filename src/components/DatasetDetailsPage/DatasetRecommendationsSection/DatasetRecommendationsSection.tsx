"use client";

import { Chip } from "@ui/Chip";
import FormattedText from "@ui/FormattedText";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDisplayCategory } from "@/config/collectionConstants";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { mapApiDatasetToDataset } from "@/lib/datasetMapping";
import { logError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import styles from "./DatasetRecommendationsSection.module.scss";
import DatasetRecommendationsSkeleton from "./DatasetRecommendationsSkeleton";

interface DatasetRecommendationsSectionProps {
  datasetId: string;
}

export default function DatasetRecommendationsSection({
  datasetId,
}: DatasetRecommendationsSectionProps) {
  const router = useRouter();
  const { getDatasetRecommendations } = useApi();
  const [recommendations, setRecommendations] = useState<DatasetPlus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const result = await getDatasetRecommendations(datasetId);
        if (!cancelled) setRecommendations(result.map(mapApiDatasetToDataset));
      } catch (error) {
        logError("Failed to load dataset recommendations", error, {
          datasetId,
        });
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [datasetId, getDatasetRecommendations]);

  const handleCardClick = (dataset: DatasetPlus) => {
    router.push(getNavigationUrl(`/datasets/${dataset.id}`));
  };

  if (isLoading) return <DatasetRecommendationsSkeleton />;
  if (recommendations.length === 0) return null;

  return (
    <div className={styles.datasetRecommendationsSection}>
      <h3 className={styles.datasetRecommendationsSection__title}>
        Recommended datasets
      </h3>
      <div className={styles.datasetRecommendationsSection__grid}>
        {recommendations.map((dataset) => (
          <div
            key={dataset.id}
            className={styles.datasetRecommendationsSection__card}
            onClick={() => handleCardClick(dataset)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick(dataset);
              }
            }}
            aria-label={`View details for ${dataset.title}`}
          >
            <div className={styles.datasetRecommendationsSection__cardContent}>
              <div className={styles.datasetRecommendationsSection__cardHeader}>
                <h4 className={styles.datasetRecommendationsSection__cardTitle}>
                  {dataset.title}
                </h4>
                <div
                  className={styles.datasetRecommendationsSection__cardChips}
                >
                  <Chip color="info" variant="outline" size="sm">
                    {getDisplayCategory(dataset.collections, dataset.category)}
                  </Chip>
                  <Chip
                    color={
                      dataset.access === "Open Access" ? "success" : "warning"
                    }
                    size="sm"
                  >
                    {dataset.access}
                  </Chip>
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
        ))}
      </div>
    </div>
  );
}
