"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useCollections } from "@/contexts/CollectionsContext";
import { useDatasetSearch } from "@/hooks/useDatasetSearch";
import { getNavigationUrl } from "@/lib/utils";

interface UseCasePageClientProps {
  collectionName: string;
  title: string;
  subtitle: string;
  withLayout?: boolean;
}

export default function UseCasePageClient({
  collectionName,
  title,
  subtitle,
  withLayout = true,
}: UseCasePageClientProps) {
  const router = useRouter();
  const { apiCollections, isLoadingApiCollections } = useCollections();

  // The use case lists one built-in collection, found by name among the
  // built-in ones only (a user's own collection may share the name). Nothing
  // is requested until it is known.
  const collectionId = useMemo(() => {
    const normalized = collectionName.toLowerCase().trim();
    return (
      apiCollections.find((c) => c.name?.toLowerCase().trim() === normalized)
        ?.id ?? null
    );
  }, [apiCollections, collectionName]);
  const isMissingCollection = !collectionId && !isLoadingApiCollections;

  const search = useDatasetSearch({
    scope: collectionId
      ? { kind: "collection", id: String(collectionId) }
      : null,
  });

  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);

  useEffect(() => {
    localStorage.removeItem("chatSelectedDatasets");
  }, []);

  const handleChatWithData = useCallback(() => {
    localStorage.setItem(
      "chatSelectedDatasets",
      JSON.stringify(selectedDatasets),
    );
    router.push(getNavigationUrl("/chat"));
  }, [router, selectedDatasets]);

  // Browse asks for a selection first.
  const handleAddToCollection = useCallback(() => {
    setShowCreateCollectionModal(true);
  }, []);

  const content = (
    <div className="relative p-6">
      <Browse
        datasets={isMissingCollection ? [] : search.datasets}
        title={title}
        subtitle={subtitle}
        showSelectAll={true}
        showSearchAndFilters={true}
        searchTerm={search.pendingSearchTerm}
        onSearchTermChange={search.onSearchTermChange}
        onSearchTermSubmit={search.onSearchTermSubmit}
        appliedSearchTerm={search.appliedSearchTerm}
        isSmartSearchEnabled={search.isSmartSearchEnabled}
        onSmartSearchToggle={search.onSmartSearchToggle}
        sortBy={search.sortBy}
        onSortByChange={search.onSortByChange}
        filters={search.filters}
        onApplyFilters={search.onApplyFilters}
        totalCount={search.totalCount}
        hasMore={search.hasMore}
        isLoadingMore={search.isLoadingMore}
        onLoadMore={() => void search.onLoadMore()}
        loadMoreError={search.loadMoreError}
        selectedDatasets={selectedDatasets}
        onSelectedDatasetsChange={setSelectedDatasets}
        showSelectedPanel={showSelectedPanel}
        onCloseSidebar={() => setShowSelectedPanel(false)}
        onReopenSidebar={() => setShowSelectedPanel(true)}
        onChatWithData={handleChatWithData}
        onAddToCollection={handleAddToCollection}
        isLoading={!isMissingCollection && search.isLoading}
        error={
          isMissingCollection
            ? `The ${collectionName} collection could not be found.`
            : search.error
        }
      />

      <CreateCollectionModal
        isVisible={showCreateCollectionModal}
        onClose={() => setShowCreateCollectionModal(false)}
        selectedDatasets={selectedDatasets}
        datasets={search.datasets}
      />
    </div>
  );

  if (!withLayout) return content;

  return <DashboardLayout>{content}</DashboardLayout>;
}
