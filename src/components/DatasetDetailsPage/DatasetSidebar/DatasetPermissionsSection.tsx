"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { Lock, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { APP_ROUTES } from "@/config/appUrls";
import { getNavigationUrl } from "@/lib/utils";
import styles from "./DatasetSidebarSection.module.scss";

type PermissionLevel = "Owner" | "Editor" | "Viewer";

interface DatasetPermissionsSectionProps {
  datasetId: string;
  datasetName: string;
  hasBrowsePermission: boolean;
  hasEditPermission: boolean;
  hasDownloadPermission: boolean;
  hasManagePermission: boolean;
  permissions: string[];
}

function getPermissionLevel(
  hasManagePermission: boolean,
  hasEditPermission: boolean,
  hasDownloadPermission: boolean,
): PermissionLevel {
  if (hasManagePermission) return "Owner";
  if (hasEditPermission || hasDownloadPermission) return "Editor";
  return "Viewer";
}

export default function DatasetPermissionsSection({
  datasetId,
  hasBrowsePermission: _hasBrowsePermission,
  hasEditPermission,
  hasDownloadPermission,
  hasManagePermission,
  permissions,
  datasetName: _datasetName,
}: DatasetPermissionsSectionProps) {
  const router = useRouter();
  const level = getPermissionLevel(
    hasManagePermission,
    hasEditPermission,
    hasDownloadPermission,
  );

  const displayLevel = permissions.length === 0 ? "Viewer" : level;

  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Lock className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>
            Your permission
          </h3>
        </div>
        {hasManagePermission && (
          <Button
            variant="outline"
            size="sm"
            className={styles.datasetSidebarSection__button}
            onClick={() =>
              router.push(
                getNavigationUrl(
                  datasetId
                    ? APP_ROUTES.SETTINGS_ROLES_DATASET(datasetId)
                    : APP_ROUTES.SETTINGS_ROLES,
                ),
              )
            }
          >
            <Settings2 className={styles.datasetSidebarSection__buttonIcon} />
            Manage
          </Button>
        )}
      </div>
      <Chip color="info" variant="outline" size="sm">
        {displayLevel}
      </Chip>
    </div>
  );
}
