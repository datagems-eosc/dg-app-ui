"use client";

import styles from "./MiniHistogram.module.scss";

interface MiniHistogramProps {
  values: number[];
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export default function MiniHistogram({
  values,
  min,
  max,
  minLabel,
  maxLabel,
}: MiniHistogramProps) {
  const maxBarHeight = Math.max(...values);
  const chartHeight = 165;
  const chartWidth = 219;
  const barWidth = chartWidth / values.length;
  const padding = 30;

  return (
    <div className={styles.miniHistogram}>
      {/* Y-axis scale */}
      <div className={styles.miniHistogram__yAxis}>
        <span className={styles.miniHistogram__yLabel}>100</span>
        <span className={styles.miniHistogram__yLabel}>80</span>
        <span className={styles.miniHistogram__yLabel}>60</span>
        <span className={styles.miniHistogram__yLabel}>40</span>
        <span className={styles.miniHistogram__yLabel}>20</span>
        <span className={styles.miniHistogram__yLabel}>0</span>
      </div>

      {/* Chart */}
      <div className={styles.miniHistogram__chart}>
        <svg
          width={chartWidth}
          height={chartHeight + 50}
          className={styles.miniHistogram__svg}
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={`grid-${i}`}
              x1={0}
              y1={i * 31.5 + 9}
              x2={chartWidth}
              y2={i * 31.5 + 9}
              className={styles.miniHistogram__gridLine}
            />
          ))}

          {/* Bars */}
          {values.map((value, index) => {
            const barHeight = (value / maxBarHeight) * chartHeight;
            const x = index * barWidth + barWidth * 0.1;
            const y = chartHeight - barHeight;
            const width = barWidth * 0.8;

            return (
              <rect
                key={`bar-${index}`}
                x={x}
                y={y}
                width={width}
                height={barHeight}
                className={styles.miniHistogram__bar}
              />
            );
          })}

          {/* X-axis labels */}
          <text
            x={0}
            y={chartHeight + 20}
            className={styles.miniHistogram__xLabel}
          >
            {minLabel || min.toFixed(1)}
          </text>
          <text
            x={chartWidth - 40}
            y={chartHeight + 20}
            className={styles.miniHistogram__xLabel}
          >
            {maxLabel || max.toFixed(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}
