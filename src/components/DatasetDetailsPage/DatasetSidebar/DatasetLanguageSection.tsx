"use client";

import { Languages } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetLanguageSectionProps {
  language?: string;
}

export default function DatasetLanguageSection({
  language,
}: DatasetLanguageSectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Languages className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Language</h3>
        </div>
      </div>
      <div className={styles.datasetSidebarSection__badge}>
        <span className={styles.datasetSidebarSection__badgeText}>
          {(language || "EN").toUpperCase()}
        </span>
      </div>
    </div>
  );
}
