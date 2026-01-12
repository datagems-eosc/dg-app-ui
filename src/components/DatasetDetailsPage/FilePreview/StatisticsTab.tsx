"use client";

import type { ColumnStatistics, FileColumn } from "@/types/filePreview";
import styles from "./StatisticsTab.module.scss";

interface StatisticsTabProps {
  statistics: ColumnStatistics[];
  columns: FileColumn[];
}

export default function StatisticsTab({
  statistics,
  columns,
}: StatisticsTabProps) {
  const visibleColumns = columns.filter((col) => col.visible);

  return (
    <div className={styles.statisticsTab}>
      <div className={styles.statisticsTab__grid}>
        {visibleColumns.map((column) => {
          const stats = statistics.find((s) => s.columnId === column.id);
          if (!stats) return null;

          return (
            <div key={column.id} className={styles.statisticsTab__card}>
              <h4 className={styles.statisticsTab__columnName}>
                {column.name}
              </h4>

              <div className={styles.statisticsTab__metrics}>
                {stats.uniqueValues !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Unique Values
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.uniqueValues.toLocaleString()}
                    </span>
                  </div>
                )}

                {stats.nullCount !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Null Count
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.nullCount.toLocaleString()}
                    </span>
                  </div>
                )}

                {stats.missingPercentage !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Missing
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.missingPercentage}%
                    </span>
                  </div>
                )}

                {stats.min !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Min
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.min}
                    </span>
                  </div>
                )}

                {stats.max !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Max
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.max}
                    </span>
                  </div>
                )}

                {stats.mean !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Mean
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.mean.toFixed(2)}
                    </span>
                  </div>
                )}

                {stats.median !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Median
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.median.toFixed(2)}
                    </span>
                  </div>
                )}

                {stats.stdDev !== undefined && (
                  <div className={styles.statisticsTab__metric}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Std Dev
                    </span>
                    <span className={styles.statisticsTab__metricValue}>
                      {stats.stdDev.toFixed(2)}
                    </span>
                  </div>
                )}

                {stats.topValues && stats.topValues.length > 0 && (
                  <div className={styles.statisticsTab__topValues}>
                    <span className={styles.statisticsTab__metricLabel}>
                      Top Values
                    </span>
                    <div className={styles.statisticsTab__topValuesList}>
                      {stats.topValues.map((tv, idx) => (
                        <div
                          key={idx}
                          className={styles.statisticsTab__topValue}
                        >
                          <span>{tv.value}</span>
                          <span className={styles.statisticsTab__topValueCount}>
                            ({tv.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
