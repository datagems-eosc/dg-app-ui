"use client";

import { Globe } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetSourceUrlSectionProps {
  url?: string;
}

export default function DatasetSourceUrlSection({
  url,
}: DatasetSourceUrlSectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Globe className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Source URL</h3>
        </div>
      </div>
      <a
        href={url || "https://example.com/datasets/very-long-url-here"}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.datasetSidebarSection__link}
      >
        {url || "https://example.com/datasets/very-long-url-here"}
      </a>
    </div>
  );
}
