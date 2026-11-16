"use client";

import { Link } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetSourceUrlSectionProps {
  url?: string;
}

export default function DatasetSourceUrlSection({
  url,
}: DatasetSourceUrlSectionProps) {
  if (!url?.trim()) return null;

  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Link className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Source URL</h3>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.datasetSidebarSection__link}
      >
        {url}
      </a>
    </div>
  );
}
