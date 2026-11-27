"use client";

import { Button } from "@ui/Button";
import { FoldedChipList } from "@ui/FoldedChipList";
import { DatasetPermissionsModal } from "@ui/user/DatasetPermissionsModal";
import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { getNavigationUrl } from "@/lib/utils";
import DatasetSidebarSection, {
  sidebarNoteClass,
} from "./DatasetSidebarSection";

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

export default function DatasetPermissionsSection({
  datasetId,
  hasManagePermission,
  permissions,
  datasetName,
}: DatasetPermissionsSectionProps) {
  const router = useRouter();

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
      <p className={sidebarNoteClass}>Permissions unavailable</p>
    ) : displayPermissions.length === 0 ? (
      <p className={sidebarNoteClass}>No permissions shown</p>
    ) : (
      <FoldedChipList
        items={displayPermissions.map((key) => PERMISSION_LABELS[key] ?? key)}
        label="Your permissions"
        about="permissions"
      />
    );

  const buttonClass = "shrink-0 gap-1.5 max-lg:h-11";
  const action = groupAccessEnabled
    ? hasManagePermission && (
        <Button
          variant="outline"
          size="sm"
          className={buttonClass}
          // "Manage" keeps the button beside the title in the narrow column.
          aria-label="Manage access"
          disabled={!datasetId}
          onClick={() => setIsAccessOpen(true)}
        >
          <Settings2 aria-hidden="true" className="size-4" />
          Manage
        </Button>
      )
    : hasManagePermission && (
        <Button
          variant="outline"
          size="sm"
          className={buttonClass}
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
          <Settings2 aria-hidden="true" className="size-4" />
          Manage
        </Button>
      );

  return (
    <DatasetSidebarSection title="Your permissions" action={action}>
      {permissionsContent}

      {/*
        The same destination the settings roles table opens, so there is one
        component and one set of promises rather than a second dataset-sharing
        screen. Mounted only while open, and only behind the flag.
      */}
      {groupAccessEnabled && hasManagePermission && isAccessOpen && (
        <DatasetPermissionsModal
          isOpen
          datasetId={datasetId}
          datasetName={datasetName}
          onClose={() => setIsAccessOpen(false)}
        />
      )}
    </DatasetSidebarSection>
  );
}
