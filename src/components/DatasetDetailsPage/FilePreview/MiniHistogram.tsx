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
  // Normalize values to max 32px height
  const maxValue = Math.max(...values);
  const normalizedValues = values.map((v) =>
    maxValue > 0 ? (v / maxValue) * 32 : 0,
  );
  return (
    <div className={styles.miniHistogram}>
      {/* Bars container */}
      <div className={styles.miniHistogram__bars}>
        {normalizedValues.map((height, index) => (
          <div
            key={`bar-${index}`}
            className={styles.miniHistogram__bar}
            style={{ height: `${height}px` }}
          />
        ))}
      </div>

      {/* Min/Max labels */}
      <div className={styles.miniHistogram__labels}>
        <span className={styles.miniHistogram__label}>
          {minLabel || min.toFixed(1)}
        </span>
        <span className={styles.miniHistogram__label}>
          {maxLabel || max.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
