"use client";

import { Chip } from "@ui/Chip";
import { Eye } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetVisibilitySectionProps {
  displayAccess: string;
}

export default function DatasetVisibilitySection({
  displayAccess,
}: DatasetVisibilitySectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Eye className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Visibility</h3>
        </div>
      </div>
      <Chip
        color={displayAccess === "Open Access" ? "success" : "warning"}
        size="sm"
      >
        {displayAccess}
      </Chip>
    </div>
  );
}
