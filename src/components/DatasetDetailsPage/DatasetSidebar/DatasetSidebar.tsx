"use client";

import { useState } from "react";
import AddToCollectionModal from "@/components/AddToCollectionModal";
import type { DatasetPlus } from "@/data/dataset";
import DatasetCitationSection from "./DatasetCitationSection";
import DatasetCollectionSection from "./DatasetCollectionSection";
import DatasetCountrySection from "./DatasetCountrySection";
import DatasetLanguageSection from "./DatasetLanguageSection";
import DatasetLicenseSection from "./DatasetLicenseSection";
import DatasetPermissionsSection from "./DatasetPermissionsSection";
import styles from "./DatasetSidebar.module.scss";
import DatasetSourceUrlSection from "./DatasetSourceUrlSection";
import DatasetVisibilitySection from "./DatasetVisibilitySection";

interface DatasetSidebarProps {
  dataset: DatasetPlus;
  displayCategory: string;
  displayAccess: string;
  permissions: string[];
  hasBrowsePermission: boolean;
  hasEditPermission: boolean;
  hasDownloadPermission: boolean;
  hasManagePermission: boolean;
}

export default function DatasetSidebar({
  dataset,
  displayCategory,
  displayAccess,
  permissions,
  hasBrowsePermission,
  hasEditPermission,
  hasDownloadPermission,
  hasManagePermission,
}: DatasetSidebarProps) {
  const [showAddToCollectionModal, setShowAddToCollectionModal] =
    useState(false);

  return (
    <div className={styles.datasetSidebar}>
      <DatasetCollectionSection
        displayCategory={displayCategory}
        onAddClick={() => setShowAddToCollectionModal(true)}
      />

      <DatasetPermissionsSection
        hasBrowsePermission={hasBrowsePermission}
        hasEditPermission={hasEditPermission}
        hasDownloadPermission={hasDownloadPermission}
        hasManagePermission={hasManagePermission}
        permissions={permissions}
      />

      <DatasetVisibilitySection displayAccess={displayAccess} />

      <DatasetLicenseSection license={dataset.license} />

      <DatasetSourceUrlSection url={dataset.url} />

      <DatasetLanguageSection language={dataset.language} />

      {dataset.country && <DatasetCountrySection country={dataset.country} />}

      {dataset.citation && (
        <DatasetCitationSection citation={dataset.citation} />
      )}

      <AddToCollectionModal
        isVisible={showAddToCollectionModal}
        onClose={() => setShowAddToCollectionModal(false)}
        dataset={dataset}
      />
    </div>
  );
}
