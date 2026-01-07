"use client";

import { Chip } from "@ui/Chip";
import { FileLock } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetLicenseSectionProps {
  license?: string;
}

export default function DatasetLicenseSection({
  license,
}: DatasetLicenseSectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <FileLock className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>License</h3>
        </div>
      </div>
      <Chip color="success" variant="regular" size="sm">
        {license || "Apache License 2.0"}
      </Chip>
    </div>
  );
}
