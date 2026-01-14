"use client";

import { AlignLeft, Hash, Type } from "lucide-react";
import type { ColumnStatistics, FileColumn } from "@/types/filePreview";
import styles from "./StatisticsTab.module.scss";

interface StatisticsTabProps {
  statistics: ColumnStatistics[];
  columns: FileColumn[];
  totalRows?: number;
  totalMissingPercentage?: number;
}

function getColumnIcon(type: string) {
  switch (type) {
    case "numeric":
    case "number":
      return Hash;
    case "categorical":
    case "text":
      return Type;
    default:
      return AlignLeft;
  }
}

// Large Histogram component for Statistics Tab (not mini)
function LargeHistogram({
  values,
  min,
  max,
  minLabel,
  maxLabel,
}: {
  values: number[];
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}) {
  const maxBarHeight = Math.max(...values);
  const chartHeight = 165;
  const chartWidth = 219;
  const barWidth = chartWidth / values.length;

  return (
    <div className={styles.largeHistogram}>
      {/* Y-axis scale */}
      <div className={styles.largeHistogram__yAxis}>
        <span className={styles.largeHistogram__yLabel}>100</span>
        <span className={styles.largeHistogram__yLabel}>80</span>
        <span className={styles.largeHistogram__yLabel}>60</span>
        <span className={styles.largeHistogram__yLabel}>40</span>
        <span className={styles.largeHistogram__yLabel}>20</span>
        <span className={styles.largeHistogram__yLabel}>0</span>
      </div>

      {/* Chart */}
      <div className={styles.largeHistogram__chart}>
        <svg
          width={chartWidth}
          height={chartHeight + 57}
          className={styles.largeHistogram__svg}
        >
          {/* Grid lines */}
          {[0, 31.5, 63, 94.5, 126, 157.5].map((y, i) => (
            <line
              key={i}
              x1="0"
              y1={y + 9}
              x2={chartWidth}
              y2={y + 9}
              className={styles.largeHistogram__gridLine}
            />
          ))}

          {/* Bars */}
          {values.map((value, index) => {
            const height = (value / maxBarHeight) * chartHeight;
            const x = index * barWidth;
            const y = chartHeight - height;

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={barWidth - 2}
                height={height}
                className={styles.largeHistogram__bar}
              />
            );
          })}

          {/* X-axis labels */}
          <text
            x="0"
            y={chartHeight + 20}
            className={styles.largeHistogram__xLabel}
          >
            {minLabel || min}
          </text>
          <text
            x={chartWidth - 50}
            y={chartHeight + 20}
            className={styles.largeHistogram__xLabel}
          >
            {maxLabel || max}
          </text>
        </svg>
      </div>
    </div>
  );
}

export default function StatisticsTab({
  statistics,
  columns,
  totalRows = 0,
  totalMissingPercentage = 0,
}: StatisticsTabProps) {
  const visibleColumns = columns.filter((col) => col.visible);

  return (
    <div className={styles.statisticsTab}>
      {/* Table Summary */}
      <div className={styles.statisticsTab__tableSummary}>
        <div className={styles.statisticsTab__summaryLabel}>Table Summary</div>
        <div className={styles.statisticsTab__summaryStats}>
          <div className={styles.statisticsTab__summaryItem}>
            <span className={styles.statisticsTab__summaryTitle}>
              Total rows
            </span>
            <span className={styles.statisticsTab__summaryValue}>
              {totalRows}
            </span>
          </div>
          <div className={styles.statisticsTab__summaryItem}>
            <span className={styles.statisticsTab__summaryTitle}>
              Missing values
            </span>
            <span className={styles.statisticsTab__summaryValue}>
              {totalMissingPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Column Statistics */}
      {visibleColumns.map((column) => {
        const stats = statistics.find((s) => s.columnId === column.id);
        if (!stats) return null;

        const IconComponent = getColumnIcon(column.type);
        const isNumeric = column.type === "numeric" || column.type === "number";

        return (
          <div key={column.id} className={styles.statisticsTab__colStats}>
            {/* Column Header */}
            <div className={styles.statisticsTab__colHeader}>
              <div className={styles.statisticsTab__colName}>
                <IconComponent className={styles.statisticsTab__icon} />
                <span>{column.name}</span>
              </div>
              {column.description && (
                <div className={styles.statisticsTab__colDescription}>
                  {column.description}
                </div>
              )}
            </div>

            {/* Metrics and Chart Container */}
            <div className={styles.statisticsTab__content}>
              {/* Left Side: Metrics */}
              <div className={styles.statisticsTab__metrics}>
                {isNumeric ? (
                  <>
                    {/* Row 1 */}
                    <div className={styles.statisticsTab__metricsRow}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Max value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.max ?? "-"}
                        </span>
                      </div>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Mean value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.mean ?? "-"}
                        </span>
                      </div>
                    </div>

                    {/* Row 2 */}
                    <div className={styles.statisticsTab__metricsRow}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Standard deviation
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.stdDev ?? "-"}
                        </span>
                      </div>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Quantiles (0.25, 0.5, 0.75)
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.median ? `${stats.median}` : "-"}
                        </span>
                      </div>
                    </div>

                    {/* Row 3 */}
                    <div className={styles.statisticsTab__metricsRow}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Min value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.min ?? "-"}
                        </span>
                      </div>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Median value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.median ?? "-"}
                        </span>
                      </div>
                    </div>

                    {/* Row 4: Missing percentage (full width) */}
                    <div className={styles.statisticsTab__metricsRowFull}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Missing percentage
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.missingPercentage}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Categorical columns metrics */}
                    <div className={styles.statisticsTab__metricsRow}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Max value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          -
                        </span>
                      </div>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Mean value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          -
                        </span>
                      </div>
                    </div>

                    <div className={styles.statisticsTab__metricsRow}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Standard deviation
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          -
                        </span>
                      </div>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Quantiles (0.25, 0.5, 0.75)
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          -
                        </span>
                      </div>
                    </div>

                    <div className={styles.statisticsTab__metricsRow}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Min value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          -
                        </span>
                      </div>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Median value
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          -
                        </span>
                      </div>
                    </div>

                    <div className={styles.statisticsTab__metricsRowFull}>
                      <div className={styles.statisticsTab__metric}>
                        <span className={styles.statisticsTab__metricLabel}>
                          Missing percentage
                        </span>
                        <span className={styles.statisticsTab__metricValue}>
                          {stats.missingPercentage ?? 0}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Side: Large Number or Histogram */}
              <div className={styles.statisticsTab__visual}>
                {isNumeric &&
                stats.distribution &&
                stats.min !== undefined &&
                stats.max !== undefined ? (
                  <LargeHistogram
                    values={stats.distribution}
                    min={
                      typeof stats.min === "number"
                        ? stats.min
                        : Number.parseFloat(String(stats.min))
                    }
                    max={
                      typeof stats.max === "number"
                        ? stats.max
                        : Number.parseFloat(String(stats.max))
                    }
                    minLabel={`${stats.min}°C`}
                    maxLabel={`${stats.max}°C`}
                  />
                ) : (
                  <div className={styles.statisticsTab__largeNumber}>
                    <span className={styles.statisticsTab__largeNumberLabel}>
                      Unique values in this column
                    </span>
                    <span className={styles.statisticsTab__largeNumberValue}>
                      {stats.uniqueValues || 0}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
