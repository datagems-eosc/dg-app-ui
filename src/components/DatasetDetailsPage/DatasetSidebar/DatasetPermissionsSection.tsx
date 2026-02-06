"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { Lock, Settings } from "lucide-react";
import { useState } from "react";
import { DatasetPermissionsModal } from "@/components/ui/user/DatasetPermissionsModal";
import styles from "./DatasetSidebarSection.module.scss";

interface DatasetPermissionsSectionProps {
  datasetId: string;
  datasetName: string;
  hasBrowsePermission: boolean;
  hasEditPermission: boolean;
  hasDownloadPermission: boolean;
  hasManagePermission: boolean;
  permissions: string[];
}

export default function DatasetPermissionsSection({
  datasetId,
  datasetName,
  hasBrowsePermission,
  hasEditPermission,
  hasDownloadPermission,
  hasManagePermission,
  permissions,
}: DatasetPermissionsSectionProps) {
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

  return (
    <>
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
            disabled={!datasetId}
            onClick={() => setIsPermissionsOpen(true)}
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
      <DatasetPermissionsModal
        isOpen={isPermissionsOpen}
        datasetId={datasetId}
        datasetName={datasetName}
        onClose={() => setIsPermissionsOpen(false)}
      />
    </>
  );
}
