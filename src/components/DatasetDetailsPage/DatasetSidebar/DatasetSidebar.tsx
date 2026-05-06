"use client";

import { Toast } from "@ui/Toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import { TOAST_MESSAGES } from "@/constants/toastMessages.mjs";
import { useCollections } from "@/contexts/CollectionsContext";
import type { Dataset, DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
import DatasetCitationSection from "./DatasetCitationSection";
import DatasetCollectionSection, {
  type SidebarCollectionRef,
} from "./DatasetCollectionSection";
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
  displayCategory: _displayCategory,
  displayAccess,
  permissions,
  hasBrowsePermission,
  hasEditPermission,
  hasDownloadPermission,
  hasManagePermission,
}: DatasetSidebarProps) {
  const api = useApi();
  const { notifyCollectionModified } = useCollections();
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);

  const initialCollections = useMemo<SidebarCollectionRef[]>(
    () => (dataset.collections ?? []).map((c) => ({ id: c.id, name: c.name })),
    [dataset.collections],
  );

  const [collections, setCollections] =
    useState<SidebarCollectionRef[]>(initialCollections);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollections(initialCollections);
  }, [initialCollections]);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToastFromConfig = useCallback(
    (config: { message: string; type: "success" | "error" }) => {
      setToastType(config.type);
      setToastMessage(config.message);
      setShowToast(true);
    },
    [],
  );

  const handleAddedToCollections = useCallback(
    (added: { id: string; name: string }[]) => {
      setCollections((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const toAdd = added.filter((c) => !existingIds.has(c.id));
        return [...prev, ...toAdd];
      });
    },
    [],
  );

  const handleRemoveCollection = useCallback(
    async (collection: SidebarCollectionRef) => {
      if (!dataset.id) return;
      const previous = collections;
      setCollections((prev) => prev.filter((c) => c.id !== collection.id));
      setRemovingIds((prev) => new Set(prev).add(collection.id));

      try {
        await api.removeDatasetFromUserCollection(collection.id, dataset.id);
        notifyCollectionModified();
        showToastFromConfig(
          TOAST_MESSAGES.datasetRemovedFromCollection(collection.name),
        );
      } catch (error) {
        logError("Failed to remove dataset from collection", error, {
          collectionId: collection.id,
          datasetId: dataset.id,
        });
        setCollections(previous);
        showToastFromConfig(TOAST_MESSAGES.datasetRemoveFailed);
      } finally {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(collection.id);
          return next;
        });
      }
    },
    [
      api,
      collections,
      dataset.id,
      notifyCollectionModified,
      showToastFromConfig,
    ],
  );

  const isRemoving = useCallback(
    (collectionId: string) => removingIds.has(collectionId),
    [removingIds],
  );

  return (
    <div className={styles.datasetSidebar}>
      <DatasetCollectionSection
        collections={collections}
        onAddClick={() => setShowCreateCollectionModal(true)}
        onRemove={handleRemoveCollection}
        isRemoving={isRemoving}
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

      <DatasetVisibilitySection displayAccess={displayAccess} />

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
        onDatasetsAddedToCollections={handleAddedToCollections}
      />

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        type={toastType}
      />
    </div>
  );
}
