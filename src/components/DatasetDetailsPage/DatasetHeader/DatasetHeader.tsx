"use client";

import type { DatasetPlus } from "@/data/dataset";
import styles from "./DatasetHeader.module.scss";

interface DatasetHeaderProps {
  dataset: DatasetPlus;
}

export default function DatasetHeader({ dataset }: DatasetHeaderProps) {
  const headline = dataset.headline?.trim();
  const showHeadline =
    headline &&
    headline !== dataset.title.trim() &&
    headline !== dataset.description.trim();

  return (
    <div className={styles.datasetHeader}>
      <h1 className={styles.datasetHeader__title}>{dataset.title}</h1>
      {showHeadline && (
        <p className={styles.datasetHeader__description}>{headline}</p>
      )}
    </div>
  );
}
