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
  const items: SpecificationItem[] = [
    {
      label: "Total Records:",
      value: specification?.totalRecords || "782 records",
    },
    {
      label: "Time range:",
      value:
        specification?.timeRange ||
        "January 1, 2001 to December 31, 2022 (22 years)",
    },
    {
      label: "Geographic Coverage:",
      value:
        specification?.geographicCoverage ||
        "Global (Latitude: -61.85° to 71.63°, Longitude: -179.97° to 179.66°)",
    },
    {
      label: "Population Density:",
      value:
        specification?.populationDensity ||
        "Varies by region, average of 55 people per km².",
    },
    {
      label: "Climate Zones:",
      value:
        specification?.climateZones || "Tropical, Temperate, Arid, and Polar.",
    },
    {
      label: "Key Biodiversity Areas:",
      value:
        specification?.keyBiodiversityAreas ||
        "Amazon Rainforest, Coral Reefs, Himalayas.",
    },
  ];

  return (
    <div className={styles.datasetSpecificationSection}>
      <h3 className={styles.datasetSpecificationSection__title}>
        Specification
      </h3>
      <div className={styles.datasetSpecificationSection__list}>
        {items.map((item, index) => (
          <div key={index} className={styles.datasetSpecificationSection__item}>
            <span className={styles.datasetSpecificationSection__label}>
              {item.label}
            </span>
            <span className={styles.datasetSpecificationSection__value}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
