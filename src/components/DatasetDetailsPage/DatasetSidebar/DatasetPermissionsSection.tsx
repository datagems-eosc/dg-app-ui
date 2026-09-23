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
  /**
   * Capability labels the caller holds, `[]` when the read returned none, and
   * `undefined` when the permission evidence could not be read at all. The
   * last two look different on screen and must not be merged.
   */
  permissions: string[] | undefined;
}

/** Neutral copy, reusing the application's existing empty-state type role. */
const EMPTY_TEXT_CLASS =
  "text-descriptions-12-regular tracking-1p text-gray-650";

export default function DatasetPermissionsSection({
  datasetId,
  hasManagePermission,
  permissions,
  datasetName: _datasetName,
}: DatasetPermissionsSectionProps) {
  const router = useRouter();

  // Known capabilities first, in a stable order, then anything else the caller
  // was given. Nothing is invented: a "Viewer" chip used to be rendered
  // whenever this list was empty, which presented a role the Gateway had never
  // reported and that does not exist in its permission vocabulary.
  const displayPermissions = permissions
    ? [
        ...PERMISSION_ORDER.filter((key) =>
          permissions.some((p) => p.toLowerCase() === key.toLowerCase()),
        ),
        ...permissions.filter(
          (p) =>
            !PERMISSION_ORDER.some(
              (key) => key.toLowerCase() === p.toLowerCase(),
            ),
        ),
      ]
    : [];

  const permissionsContent =
    permissions === undefined ? (
      <span className={EMPTY_TEXT_CLASS}>Not available</span>
    ) : displayPermissions.length === 0 ? (
      <span className={EMPTY_TEXT_CLASS}>No permissions</span>
    ) : (
      displayPermissions.map((key) => (
        <Chip key={key} color="grey" variant="regular" size="sm">
          {PERMISSION_LABELS[key] ?? key}
        </Chip>
      ))
    );

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
        {permissionsContent}
      </div>
    </div>
  );
}
