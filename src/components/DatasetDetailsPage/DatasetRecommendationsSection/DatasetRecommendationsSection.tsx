"use client";

import { Chip } from "@ui/Chip";
import FormattedText from "@ui/FormattedText";
import { Notice } from "@ui/Notice";
import { WorkingStatus } from "@ui/WorkingStatus";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { getDisplayCollectionLabel } from "@/config/collectionConstants";
import { useDatasetRecommendations } from "@/hooks/useDatasetRecommendations";
import type { MappedDataset } from "@/lib/datasetMapping";
import type { DatasetRecommendationsResult } from "@/lib/datasetRecommendations";
import { getNavigationUrl } from "@/lib/utils";
import styles from "./DatasetRecommendationsSection.module.scss";
import DatasetRecommendationsSkeleton from "./DatasetRecommendationsSkeleton";

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
  const result = useDatasetRecommendations(datasetId);

  const handleCardClick = (dataset: MappedDataset) => {
    router.push(getNavigationUrl(`/datasets/${dataset.id}`));
  };

  const loading = result === null;
  const datasets = result?.status === "datasets" ? result.datasets : null;
  const note =
    result === null || result.status === "datasets"
      ? null
      : NOTES[result.status];

  return (
    <div className={styles.datasetRecommendationsSection}>
      <div className={styles.datasetRecommendationsSection__header}>
        <h3 className={styles.datasetRecommendationsSection__title}>
          Recommended datasets
        </h3>
        {/* Hidden, not removed, once the answer arrives: the header keeps its
            height and the grid does not move. The first answer can take
            about 40 seconds; no time limit. */}
        <div
          className={clsx(
            styles.datasetRecommendationsSection__status,
            !loading && "invisible",
          )}
          aria-hidden={!loading || undefined}
        >
          <WorkingStatus messages={["Finding similar datasets"]} />
        </div>
      </div>
      {/* One block, so the section's gap adds no space around the empty
          live region. */}
      <div>
        {loading && <DatasetRecommendationsSkeleton />}
        {datasets && (
          <RecommendationGrid
            recommendations={datasets}
            onOpen={handleCardClick}
          />
        )}
        {/* On the page from the start: screen readers skip a live region
            that appears with its text already in it. */}
        <div role="status">
          {note && <Notice tone="neutral" title={note} />}
        </div>
      </div>
    </div>
  );
}

function RecommendationGrid({
  recommendations,
  onOpen,
}: {
  recommendations: MappedDataset[];
  onOpen: (dataset: MappedDataset) => void;
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
