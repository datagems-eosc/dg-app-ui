"use client";

import { Check } from "lucide-react";
import type { DatasetPackage } from "@/data/package";
import type { DatasetUnion } from "@/types/datasets";
import styles from "./PackageCard.module.scss";

interface PackageCardProps {
  datasetPackage: DatasetPackage;
  datasets: DatasetUnion[];
  isSelected: boolean;
  onSelectPackage: (packageId: string) => void;
  onDeselectPackage: (packageId: string) => void;
  maxDatasetsDisplay?: number;
}

function getDatasetName(dataset: DatasetUnion): string {
  if ("title" in dataset && dataset.title) return dataset.title;
  if ("name" in dataset && dataset.name) return dataset.name;
  return "Unknown Dataset";
}

export default function PackageCard({
  datasetPackage,
  datasets,
  isSelected,
  onSelectPackage,
  onDeselectPackage,
  maxDatasetsDisplay = 4,
}: PackageCardProps) {
  const datasetMap = new Map(datasets.map((d) => [d.id, d]));
  const displayDatasets = datasetPackage.datasetIds
    .slice(0, maxDatasetsDisplay)
    .map((id) => ({
      id,
      name: datasetMap.get(id) ? getDatasetName(datasetMap.get(id)!) : id,
    }))
    .filter(Boolean);
  const datasetCount = datasetPackage.datasetIds.length;

  const handleToggle = () => {
    if (isSelected) {
      onDeselectPackage(datasetPackage.id);
    } else {
      onSelectPackage(datasetPackage.id);
    }
  };

  return (
    <article
      className={`${styles.card} ${isSelected ? styles.isSelected : ""}`}
      aria-label={`Package: ${datasetPackage.title}`}
    >
      <div className={styles.title}>
        <span className={styles.chip}>{datasetPackage.title}</span>
      </div>
      <ul className={styles.datasetList} role="list">
        {displayDatasets.map(({ id, name }) => (
          <li key={id} className={styles.datasetRow}>
            <Check className={`${styles.checkIcon} shrink-0`} aria-hidden />
            <span className={styles.datasetName} title={name}>
              {name}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={isSelected}
          aria-label={
            isSelected
              ? `Deselect ${datasetPackage.title}`
              : `Select ${datasetPackage.title}`
          }
          className={styles.footerButton}
        >
          {isSelected ? "Deselect" : "Select"}
        </button>
        <span className={styles.datasetCount}>
          {datasetCount} {datasetCount === 1 ? "dataset" : "datasets"}
        </span>
      </div>
    </article>
  );
}
