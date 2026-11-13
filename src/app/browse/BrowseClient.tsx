"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { APP_ROUTES } from "@/config/appUrls";
import { useCollections } from "@/contexts/CollectionsContext";
import { mockPackages } from "@/data/package";
import { useDatasetSearch } from "@/hooks/useDatasetSearch";
import { getNavigationUrl } from "@/lib/utils";
import type { ApiCollection } from "@/types/collection";
import { useBrowseHandoff } from "./useBrowseHandoff";

export default function BrowseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const handoff = useBrowseHandoff(
    searchParams.get("handoff"),
    pathname,
    router,
  );
  const selectedCollection = searchParams.get("collection");
  const isCustomCollection = searchParams.get("isCustom") === "true";
  const search = useDatasetSearch({
    scope: selectedCollection
      ? {
          kind: isCustomCollection ? "custom" : "collection",
          id: selectedCollection,
        }
      : { kind: "all" },
    handoff,
  });
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const { apiCollections, extraCollections } = useCollections();

  const collectionDisplayName = React.useMemo(() => {
    if (!selectedCollection) return null;
    const list: ApiCollection[] = isCustomCollection
      ? extraCollections
      : apiCollections;
    const found = list.find(
      (c: ApiCollection) => String(c.id) === String(selectedCollection),
    );
    return found && typeof found.name === "string"
      ? String(found.name).replace(/ Collection$/i, "")
      : null;
  }, [
    selectedCollection,
    isCustomCollection,
    apiCollections,
    extraCollections,
  ]);

  const collectionTitle = React.useMemo(() => {
    if (!selectedCollection) return null;
    const base = collectionDisplayName || "Browse";
    return /\bdatasets$/i.test(base) ? base : `${base} Datasets`;
  }, [selectedCollection, collectionDisplayName]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.removeItem("chatSelectedDatasets");
    }
  }, [isMounted]);

  const handlePackageSelect = useCallback((packageId: string) => {
    const pkg = mockPackages.find((p) => p.id === packageId);
    if (!pkg) return;
    setSelectedDatasets((prev) => {
      const next = new Set(prev);
      pkg.datasetIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
    setSelectedPackageIds((prev) =>
      prev.includes(packageId) ? prev : [...prev, packageId],
    );
    setShowSelectedPanel(true);
  }, []);

  const handlePackageDeselect = useCallback((packageId: string) => {
    const pkg = mockPackages.find((p) => p.id === packageId);
    if (!pkg) return;
    setSelectedDatasets((prev) =>
      prev.filter((id) => !pkg.datasetIds.includes(id)),
    );
    setSelectedPackageIds((prev) => prev.filter((id) => id !== packageId));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedDatasets([]);
    setSelectedPackageIds([]);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setShowSelectedPanel(false);
  }, []);

  const handleReopenSidebar = useCallback(() => {
    setShowSelectedPanel(true);
  }, []);

  const handleChatWithData = useCallback(() => {
    if (isMounted) {
      localStorage.setItem(
        "chatSelectedDatasets",
        JSON.stringify(selectedDatasets),
      );
    }
    router.push(getNavigationUrl(APP_ROUTES.CHAT));
  }, [router, isMounted, selectedDatasets]);

  // Browse asks for a selection first.
  const handleAddToCollection = useCallback(() => {
    setShowCreateCollectionModal(true);
  }, []);

  return (
    <DashboardLayout>
      <div className="relative">
        <Browse
          {...search}
          title={
            selectedCollection
              ? collectionTitle || "Browse Datasets"
              : "All datasets"
          }
          subtitle={
            selectedCollection
              ? isCustomCollection
                ? "List of your datasets"
                : `Filtered by collection`
              : "List of all datasets"
          }
          showSelectAll={true}
          showAddButton={true}
          showSearchAndFilters={!selectedCollection}
          selectedDatasets={selectedDatasets}
          onSelectedDatasetsChange={setSelectedDatasets}
          selectedPackageIds={selectedPackageIds}
          onPackageSelect={handlePackageSelect}
          onPackageDeselect={handlePackageDeselect}
          onDeselectAll={handleDeselectAll}
          showSelectedPanel={showSelectedPanel}
          onCloseSidebar={handleCloseSidebar}
          onReopenSidebar={handleReopenSidebar}
          onChatWithData={handleChatWithData}
          onAddToCollection={handleAddToCollection}
          isCustomCollection={isCustomCollection || false}
          collectionName={
            selectedCollection && isCustomCollection
              ? collectionTitle || ""
              : ""
          }
          collectionId={
            selectedCollection && isCustomCollection ? selectedCollection : ""
          }
        />

        <CreateCollectionModal
          isVisible={showCreateCollectionModal}
          onClose={() => setShowCreateCollectionModal(false)}
          selectedDatasets={selectedDatasets}
          datasets={search.datasets}
        />
      </div>
    </DashboardLayout>
  );
}
