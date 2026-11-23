"use client";

import { RECOMMENDATION_COUNT } from "@/lib/datasetRecommendations";
import styles from "./DatasetRecommendationsSection.module.scss";

/** Six placeholder cards in the final grid, as tall as real cards. */
export default function DatasetRecommendationsSkeleton() {
  return (
    <div className={styles.datasetRecommendationsSection__grid}>
      {Array.from({ length: RECOMMENDATION_COUNT }).map((_, index) => (
        <div
          key={index}
          data-testid="recommendation-placeholder"
          className={`${styles.datasetRecommendationsSection__card} ${styles.datasetRecommendationsSection__skeletonCard}`}
        >
          <div className={styles.datasetRecommendationsSection__cardContent}>
            <div className={styles.datasetRecommendationsSection__cardHeader}>
              <div
                className={`${styles.datasetRecommendationsSection__cardTitle} ${styles.datasetRecommendationsSection__skeletonBar}`}
              />
              <div className={styles.datasetRecommendationsSection__cardChips}>
                <div
                  className={`${styles.datasetRecommendationsSection__skeletonChip} ${styles.datasetRecommendationsSection__skeletonBar}`}
                />
                <div
                  className={`${styles.datasetRecommendationsSection__skeletonChip} ${styles.datasetRecommendationsSection__skeletonBar}`}
                />
              </div>
            </div>
            <div
              className={`${styles.datasetRecommendationsSection__cardDescription} ${styles.datasetRecommendationsSection__skeletonDescription}`}
            >
              <div
                className={styles.datasetRecommendationsSection__skeletonBar}
              />
              <div
                className={styles.datasetRecommendationsSection__skeletonBar}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
