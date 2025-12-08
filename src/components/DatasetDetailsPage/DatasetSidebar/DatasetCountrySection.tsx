"use client";

import { Globe } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetCountrySectionProps {
  country: string;
}

export default function DatasetCountrySection({
  country,
}: DatasetCountrySectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Globe className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Country</h3>
        </div>
      </div>
      <div className={styles.datasetSidebarSection__badge}>
        <span className={styles.datasetSidebarSection__badgeText}>
          {country.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
