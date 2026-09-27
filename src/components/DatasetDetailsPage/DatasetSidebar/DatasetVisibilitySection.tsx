"use client";

import { Chip } from "@ui/Chip";
import { Eye } from "lucide-react";
import type { DatasetSharingState } from "@/lib/datasetPermissions/types";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetVisibilitySectionProps {
  sharing: DatasetSharingState;
}

/**
 * Three states, not two. The section previously received a string that had
 * already been collapsed to "Open Access" or "Restricted", so a dataset whose
 * publication nobody had established was shown as a restricted-access warning.
 * Unknown now has its own neutral presentation and says what it means.
 */
const SHARING_PRESENTATION: Record<
  DatasetSharingState,
  { label: string; color: "success" | "warning" | "grey" }
> = {
  public: { label: "Open Access", color: "success" },
  restricted: { label: "Restricted", color: "warning" },
  unknown: { label: "Sharing not verified", color: "grey" },
};

export default function DatasetVisibilitySection({
  sharing,
}: DatasetVisibilitySectionProps) {
  const { label, color } = SHARING_PRESENTATION[sharing];

  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Eye className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>Visibility</h3>
        </div>
      </div>
      <Chip color={color} size="sm">
        {label}
      </Chip>
    </div>
  );
}
