"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { Lock, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { APP_ROUTES } from "@/config/appUrls";
import { getNavigationUrl } from "@/lib/utils";
import styles from "./DatasetSidebarSection.module.scss";

const PERMISSION_LABELS: Record<string, string> = {
  Browse: "Browse",
  Edit: "Edit",
  Download: "Download",
  Manage: "Manage",
};

const PERMISSION_ORDER = ["Browse", "Edit", "Download", "Manage"];

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
  hasManagePermission,
  permissions,
  datasetName: _datasetName,
}: DatasetPermissionsSectionProps) {
  const router = useRouter();

  const displayPermissions = PERMISSION_ORDER.filter((key) =>
    permissions.some((p) => p.toLowerCase() === key.toLowerCase()),
  );

  const permissionChips =
    displayPermissions.length > 0
      ? displayPermissions.map((key) => (
          <Chip key={key} color="grey" variant="regular" size="sm">
            {PERMISSION_LABELS[key] ?? key}
          </Chip>
        ))
      : [
          <Chip key="viewer" color="grey" variant="regular" size="sm">
            Viewer
          </Chip>,
        ];

  return (
    <div className={styles.datasetSidebarSection}>
      <div className={styles.datasetSidebarSection__header}>
        <div className={styles.datasetSidebarSection__headerLeft}>
          <Lock className={styles.datasetSidebarSection__icon} />
          <h3 className={styles.datasetSidebarSection__title}>
            Your Permissions
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
      <div className={styles.datasetSidebarSection__chips}>
        {permissionChips}
      </div>
    </div>
  );
}
