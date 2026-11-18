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
  ranges,
  min,
  max,
  label,
}: {
  values: number[];
  ranges?: [number, number][];
  min: number;
  max: number;
  label: string;
}) {
  const intervals = 5;
  const maxCount = values.reduce((max, count) => Math.max(max, count), 0);
  const stepEstimate = Math.max(1, maxCount / intervals);
  const magnitude = 10 ** Math.floor(Math.log10(stepEstimate));
  const step = Math.ceil(stepEstimate / magnitude) * magnitude;
  const axisMax = step * intervals;
  const ticks = Array.from(
    { length: intervals + 1 },
    (_, i) => axisMax - i * step,
  );
  const chartHeight = 165;
  const chartWidth = 219;
  const chartTop = 9;
  const equalWidth = chartWidth / values.length;
  const minLabel = metricFormatter.format(min);
  const maxLabel = metricFormatter.format(max);
  const labelsCollide = min !== max && minLabel === maxLabel;

  return (
    <div className={styles.largeHistogram}>
      {/* Y-axis scale */}
      <div className={styles.largeHistogram__yAxis}>
        {ticks.map((count) => (
          <span key={count} className={styles.largeHistogram__yLabel}>
            {metricFormatter.format(count)}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className={styles.largeHistogram__chart}>
        <svg
          role="img"
          aria-label={label}
          width={chartWidth}
          height={chartHeight + 57}
          className={styles.largeHistogram__svg}
        >
          {/* Grid lines */}
          {ticks.map((count, index) => (
            <line
              key={count}
              x1="0"
              y1={chartTop + (index * chartHeight) / intervals}
              x2={chartWidth}
              y2={chartTop + (index * chartHeight) / intervals}
              className={styles.largeHistogram__gridLine}
            />
          ))}

          {/* Bars */}
          {values.map((value, index) => {
            const height = (value / axisMax) * chartHeight;
            const range = ranges?.[index];
            const x = range
              ? ((range[0] - min) / (max - min)) * chartWidth
              : index * equalWidth;
            const width = range
              ? ((range[1] - range[0]) / (max - min)) * chartWidth
              : equalWidth;
            const y = chartTop + chartHeight - height;

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={width - Math.min(2, width / 4)}
                height={height}
                className={styles.largeHistogram__bar}
              >
                <title>{metricFormatter.format(value)} rows</title>
              </rect>
            );
          })}

          {/* X-axis labels */}
          <text
            x="0"
            y={chartHeight + 20}
            className={styles.largeHistogram__xLabel}
          >
            {labelsCollide ? String(min) : minLabel}
          </text>
          <text
            x={chartWidth}
            y={chartHeight + 20}
            textAnchor="end"
            className={styles.largeHistogram__xLabel}
          >
            {labelsCollide ? String(max) : maxLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

const metricFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function formatMetric(value: string | number | undefined): string | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? metricFormatter.format(value) : undefined;
  }
  return value?.trim() || undefined;
}

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: string | number | undefined;
  suffix?: string;
}) {
  const formatted = formatMetric(value);
  return (
    <div className={styles.statisticsTab__metric}>
      <span className={styles.statisticsTab__metricLabel}>{label}</span>
      <span className={styles.statisticsTab__metricValue}>
        {formatted === undefined ? "Not available" : `${formatted}${suffix}`}
      </span>
    </div>
  );
}

function numericBounds(
  min: ColumnStatistics["min"],
  max: ColumnStatistics["max"],
) {
  const toNumber = (value: ColumnStatistics["min"]) => {
    const number =
      typeof value === "string" && value.trim() ? Number(value) : value;
    return typeof number === "number" && Number.isFinite(number)
      ? number
      : undefined;
  };
  const lower = toNumber(min);
  const upper = toNumber(max);
  return lower !== undefined && upper !== undefined && lower > upper
    ? ([undefined, undefined] as const)
    : ([lower, upper] as const);
}

function getHistogram(stats: ColumnStatistics) {
  const ranges = stats.distributionRanges;
  const [min, max] = numericBounds(
    ranges?.[0]?.[0] ?? stats.min,
    ranges?.at(-1)?.[1] ?? stats.max,
  );
  return stats.distribution?.length &&
    min !== undefined &&
    max !== undefined &&
    (!ranges ||
      (ranges.length === stats.distribution.length &&
        max > min &&
        Number.isFinite(max - min)))
    ? { values: stats.distribution, min, max, ranges }
    : undefined;
}

export default function StatisticsTab({
  statistics,
  columns,
  totalRows,
  totalMissingPercentage,
}: StatisticsTabProps) {
  const byColumn = new Map(statistics.map((stat) => [stat.columnId, stat]));
  const cards = columns.flatMap((column) => {
    const stats = byColumn.get(column.id);
    if (!column.visible || !stats) return [];
    const isNumeric = column.type === "numeric" || column.type === "number";
    const histogram = isNumeric ? getHistogram(stats) : undefined;
    const [min, max] = numericBounds(stats.min, stats.max);
    const displayedMetrics = [
      stats.uniqueValues,
      stats.nullCount,
      stats.missingPercentage,
    ];
    const numericMetrics = [
      min,
      max,
      stats.mean,
      stats.median,
      stats.stdDev,
      stats.percentile05,
      stats.percentile95,
    ];
    const hasMetric = (values: (string | number | undefined)[]) =>
      values.some((value) => formatMetric(value) !== undefined);
    return histogram ||
      hasMetric(displayedMetrics) ||
      (isNumeric && hasMetric(numericMetrics))
      ? [{ column, stats, isNumeric, histogram, min, max }]
      : [];
  });
  const hasSummary =
    Number.isFinite(totalRows) || Number.isFinite(totalMissingPercentage);

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
              {totalRows !== undefined && Number.isFinite(totalRows)
                ? totalRows.toLocaleString()
                : "Not available"}
            </span>
          </div>
          <div className={styles.statisticsTab__summaryItem}>
            <span className={styles.statisticsTab__summaryTitle}>
              Missing values
            </span>
            <span className={styles.statisticsTab__summaryValue}>
              {totalMissingPercentage !== undefined &&
              Number.isFinite(totalMissingPercentage)
                ? `${Math.round(totalMissingPercentage)}%`
                : "Not available"}
            </span>
          </div>
        </div>
      </div>

      {/* Column Statistics */}
      {cards.length === 0 && !hasSummary && (
        <p className={styles.statisticsTab__empty}>
          No statistics available for this file.
        </p>
      )}
      {cards.map(({ column, stats, isNumeric, histogram, min, max }) => {
        const IconComponent = getColumnIcon(column.type);

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
                {isNumeric && (
                  <>
                    <div className={styles.statisticsTab__metricsRow}>
                      <Metric label="Max value" value={max} />
                      <Metric label="Mean value" value={stats.mean} />
                    </div>
                    <div className={styles.statisticsTab__metricsRow}>
                      <Metric label="Min value" value={min} />
                      <Metric label="Median value" value={stats.median} />
                    </div>
                    <div className={styles.statisticsTab__metricsRow}>
                      <Metric
                        label="5th percentile"
                        value={stats.percentile05}
                      />
                      <Metric
                        label="95th percentile"
                        value={stats.percentile95}
                      />
                    </div>
                    <div className={styles.statisticsTab__metricsRow}>
                      <Metric label="Standard deviation" value={stats.stdDev} />
                      {histogram && (
                        <Metric
                          label="Unique values"
                          value={stats.uniqueValues}
                        />
                      )}
                    </div>
                  </>
                )}
                <div className={styles.statisticsTab__metricsRow}>
                  <Metric label="Missing rows" value={stats.nullCount} />
                  <Metric
                    label="Missing percentage"
                    value={stats.missingPercentage}
                    suffix="%"
                  />
                </div>
              </div>

              {/* Right Side: Large Number or Histogram */}
              <div className={styles.statisticsTab__visual}>
                {histogram ? (
                  <LargeHistogram
                    {...histogram}
                    label={`Distribution of ${column.name}`}
                  />
                ) : (
                  <div className={styles.statisticsTab__largeNumber}>
                    <span className={styles.statisticsTab__largeNumberLabel}>
                      Unique values in this column
                    </span>
                    <span className={styles.statisticsTab__largeNumberValue}>
                      {formatMetric(stats.uniqueValues) ?? "Not available"}
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
