"use client";

import type { DatasetPlus } from "@/data/dataset";
import styles from "./DatasetSpecificationSection.module.scss";

interface DatasetSpecificationSectionProps {
  specification?: DatasetPlus["specification"];
}

interface SpecificationItem {
  label: string;
  value: string;
}

export default function DatasetSpecificationSection({
  specification,
}: DatasetSpecificationSectionProps) {
  const candidates: { label: string; value?: string }[] = [
    { label: "Total Records:", value: specification?.totalRecords },
    { label: "Time range:", value: specification?.timeRange },
    { label: "Geographic Coverage:", value: specification?.geographicCoverage },
    { label: "Population Density:", value: specification?.populationDensity },
    { label: "Climate Zones:", value: specification?.climateZones },
    {
      label: "Key Biodiversity Areas:",
      value: specification?.keyBiodiversityAreas,
    },
  ];
  const items: SpecificationItem[] = candidates.filter(
    (item): item is SpecificationItem => Boolean(item.value?.trim()),
  );

  return (
    <div className={styles.datasetSpecificationSection}>
      <h3 className={styles.datasetSpecificationSection__title}>
        Specification
      </h3>
      {items.length > 0 ? (
        <div className={styles.datasetSpecificationSection__list}>
          {items.map((item) => (
            <div
              key={item.label}
              className={styles.datasetSpecificationSection__item}
            >
              <span className={styles.datasetSpecificationSection__label}>
                {item.label}
              </span>
              <span className={styles.datasetSpecificationSection__value}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.datasetSpecificationSection__empty}>
          No specification available for this dataset.
        </p>
      )}
    </div>
  );
}
