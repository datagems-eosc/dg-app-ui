"use client";

import { useState } from "react";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import type { Dataset, DatasetPlus } from "@/data/dataset";
import type { DatasetSharingState } from "@/lib/datasetPermissions/types";
import DatasetCitationSection from "./DatasetCitationSection";
import DatasetCollectionSection from "./DatasetCollectionSection";
import DatasetCountrySection from "./DatasetCountrySection";
import DatasetLanguageSection from "./DatasetLanguageSection";
import DatasetLicenseSection from "./DatasetLicenseSection";
import DatasetPermissionsSection from "./DatasetPermissionsSection";
import styles from "./DatasetSidebar.module.scss";
import DatasetSourceUrlSection from "./DatasetSourceUrlSection";

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
    <div className={styles.datasetSidebar}>
      <DatasetCollectionSection
        collectionLabels={(dataset.collections ?? []).map(
          (collection) => collection.name,
        )}
        onAddClick={() => setShowCreateCollectionModal(true)}
      />

      <DatasetPermissionsSection
        datasetId={dataset.id ?? ""}
        datasetName={dataset.title ?? "Dataset permissions"}
        hasBrowsePermission={hasBrowsePermission}
        hasEditPermission={hasEditPermission}
        hasDownloadPermission={hasDownloadPermission}
        hasManagePermission={hasManagePermission}
        permissions={permissions}
      />

      <DatasetLicenseSection license={dataset.license} />

      <DatasetSourceUrlSection url={dataset.url} />

      <DatasetLanguageSection language={dataset.language} />

      {dataset.country && <DatasetCountrySection country={dataset.country} />}

      {dataset.citation && (
        <DatasetCitationSection citation={dataset.citation} />
      )}

      <CreateCollectionModal
        isVisible={showCreateCollectionModal}
        onClose={() => setShowCreateCollectionModal(false)}
        selectedDatasets={dataset.id ? [dataset.id] : []}
        datasets={[dataset as Dataset]}
      />
    </div>
  );
}
