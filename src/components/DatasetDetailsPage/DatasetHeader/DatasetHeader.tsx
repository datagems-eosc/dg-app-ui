"use client";

import type { DatasetPlus } from "@/data/dataset";
import styles from "./DatasetHeader.module.scss";

interface DatasetHeaderProps {
  dataset: DatasetPlus;
}

export default function DatasetHeader({ dataset }: DatasetHeaderProps) {
  return (
    <div className={styles.datasetHeader}>
      <h1 className={styles.datasetHeader__title}>{dataset.title}</h1>
      <p className={styles.datasetHeader__description}>
        {dataset.description || "No description available."}
      </p>
    </div>
  );
}
