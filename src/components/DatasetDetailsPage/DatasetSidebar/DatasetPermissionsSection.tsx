"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { Lock, Settings } from "lucide-react";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetPermissionsSectionProps {
  hasBrowsePermission: boolean;
  hasEditPermission: boolean;
  hasDownloadPermission: boolean;
  hasManagePermission: boolean;
  permissions: string[];
}

export default function DatasetPermissionsSection({
  hasBrowsePermission,
  hasEditPermission,
  hasDownloadPermission,
  hasManagePermission,
  permissions,
}: DatasetPermissionsSectionProps) {
  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Lock className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>
            Your Permissions
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={styles.datasetSidebarSection__button}
        >
          <Settings className={styles.datasetSidebarSection__buttonIcon} />
          Manage
        </Button>
      </div>
      <div className={styles.datasetSidebarSection__chips}>
        {hasBrowsePermission && (
          <Chip color="info" variant="outline" size="sm">
            Browse
          </Chip>
        )}
        {hasEditPermission && (
          <Chip color="info" variant="outline" size="sm">
            Edit
          </Chip>
        )}
        {hasDownloadPermission && (
          <Chip color="info" variant="outline" size="sm">
            Download
          </Chip>
        )}
        {hasManagePermission && (
          <Chip color="info" variant="outline" size="sm">
            Manage
          </Chip>
        )}
        {permissions.length === 0 && (
          <Chip color="info" variant="outline" size="sm">
            Browse
          </Chip>
        )}
      </div>
    </div>
  );
}
