"use client";

import styles from "./DatasetRecommendationsSection.module.scss";

export default function DatasetRecommendationsSkeleton() {
  return (
    <div className={styles.datasetRecommendationsSection}>
      <h3
        className={`${styles.datasetRecommendationsSection__title} ${styles.datasetRecommendationsSection__skeletonTitle}`}
      >
        Recommended datasets
      </h3>
      <div className={styles.datasetRecommendationsSection__grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={`${styles.datasetRecommendationsSection__card} ${styles.datasetRecommendationsSection__skeletonCard}`}
          >
            <div className={styles.datasetRecommendationsSection__cardContent}>
              <div className={styles.datasetRecommendationsSection__cardHeader}>
                <div
                  className={`${styles.datasetRecommendationsSection__cardTitle} ${styles.datasetRecommendationsSection__skeletonBar}`}
                />
                <div
                  className={styles.datasetRecommendationsSection__cardChips}
                >
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
    </div>
  );
}
