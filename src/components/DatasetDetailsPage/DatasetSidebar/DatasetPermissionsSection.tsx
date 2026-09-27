"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { DatasetPermissionsModal } from "@ui/user/DatasetPermissionsModal";
import { Lock, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
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
  datasetName,
}: DatasetPermissionsSectionProps) {
  const router = useRouter();

  /**
   * The new entry, behind the rollout flag.
   *
   * Two differences from the legacy button beside it, both deliberate:
   *
   *  - it **opens the shared destination here**, with this page's dataset id
   *    and name, instead of navigating to settings. A dataset does not have to
   *    appear in a settings table before it can be shared;
   *  - it is **not gated on `hasManagePermission`**. That flag is derived from
   *    the `permissions.manageDataset` projection and a context-grant role
   *    label — neither of which is a Gateway permission name, and neither of
   *    which authorizes granting. The new flow reads the caller's actual
   *    effective capabilities and explains honestly when they do not allow
   *    anything, which is the difference between "you may not" and "we hid the
   *    button because of a label".
   *
   * With the flag off, everything below is exactly as it was: the same Manage
   * button, the same `hasManagePermission` gate, the same navigation.
   */
  const groupAccessEnabled = useFeatureFlag("datasetGroupAccess");
  const [isAccessOpen, setIsAccessOpen] = useState(false);

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
      <span className={EMPTY_TEXT_CLASS}>Permissions unavailable</span>
    ) : displayPermissions.length === 0 ? (
      <span className={EMPTY_TEXT_CLASS}>No permissions shown</span>
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
            Your permissions
          </h3>
        </div>
        {groupAccessEnabled ? (
          <Button
            variant="outline"
            size="sm"
            className={styles.datasetSidebarSection__button}
            disabled={!datasetId}
            onClick={() => setIsAccessOpen(true)}
          >
            <Settings2 className={styles.datasetSidebarSection__buttonIcon} />
            Manage access
          </Button>
        ) : (
          hasManagePermission && (
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
          )
        )}
      </div>
      <div className={styles.datasetSidebarSection__chips}>
        {permissionsContent}
      </div>

      {/*
        The same destination the settings roles table opens, so there is one
        component and one set of promises rather than a second dataset-sharing
        screen. Mounted only while open, and only behind the flag.
      */}
      {groupAccessEnabled && isAccessOpen && (
        <DatasetPermissionsModal
          isOpen
          datasetId={datasetId}
          datasetName={datasetName}
          onClose={() => setIsAccessOpen(false)}
        />
      )}
    </div>
  );
}
