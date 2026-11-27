"use client";

import { useState } from "react";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import type { Dataset, DatasetPlus } from "@/data/dataset";
import type { DatasetSharingState } from "@/lib/datasetPermissions/types";
import DatasetCollectionSection from "./DatasetCollectionSection";
import DatasetPermissionsSection from "./DatasetPermissionsSection";

interface DatasetSidebarProps {
  dataset: DatasetPlus;
  sharing: DatasetSharingState;
  /** `undefined` means the permission evidence could not be read. */
  permissions: string[] | undefined;
  hasBrowsePermission: boolean;
  hasEditPermission: boolean;
  hasDownloadPermission: boolean;
  hasManagePermission: boolean;
}

export default function DatasetSidebar({
  dataset,
  permissions,
  hasBrowsePermission,
  hasEditPermission,
  hasDownloadPermission,
  hasManagePermission,
}: DatasetSidebarProps) {
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);

  return (
    <aside
      aria-label="Permissions and collections"
      className="grid min-w-0 grid-cols-1 @xl/overview:grid-cols-2 @4xl/overview:grid-cols-1 @4xl/overview:grid-rows-[auto_1fr] [&>*+*]:border-t [&>*+*]:border-slate-200 @xl/overview:[&>*+*]:border-t-0 @xl/overview:[&>*+*]:border-l @4xl/overview:[&>*+*]:border-t @4xl/overview:[&>*+*]:border-l-0"
    >
      <DatasetPermissionsSection
        datasetId={dataset.id ?? ""}
        datasetName={dataset.title ?? "Dataset permissions"}
        hasBrowsePermission={hasBrowsePermission}
        hasEditPermission={hasEditPermission}
        hasDownloadPermission={hasDownloadPermission}
        hasManagePermission={hasManagePermission}
        permissions={permissions}
      />

      <DatasetCollectionSection
        collectionLabels={(dataset.collections ?? []).map(
          (collection) => collection.name,
        )}
        onAddClick={() => setShowCreateCollectionModal(true)}
      />

      <CreateCollectionModal
        isVisible={showCreateCollectionModal}
        onClose={() => setShowCreateCollectionModal(false)}
        selectedDatasets={dataset.id ? [dataset.id] : []}
        datasets={[dataset as Dataset]}
      />
    </aside>
  );
}
