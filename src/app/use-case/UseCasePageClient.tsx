"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useCollections } from "@/contexts/CollectionsContext";
import { useDatasetSearch } from "@/hooks/useDatasetSearch";
import { ApiErrorMessage } from "@/lib/apiErrors";
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
  const { apiCollections, isLoadingApiCollections, apiCollectionsFailed } =
    useCollections();

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
  // Why nothing can be listed, once the collection list has settled.
  const unavailable =
    collectionId || isLoadingApiCollections
      ? null
      : apiCollectionsFailed
        ? ApiErrorMessage.FETCH_COLLECTIONS_FAILED
        : `The ${collectionName} collection could not be found.`;

  const search = useDatasetSearch({
    scope: collectionId ? { kind: "collection", id: collectionId } : null,
  });
  const view = unavailable
    ? { ...search, datasets: [], isLoading: false, error: unavailable }
    : search;

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
        {...view}
        title={title}
        subtitle={subtitle}
        showSelectAll={true}
        showSearchAndFilters={true}
        selectedDatasets={selectedDatasets}
        onSelectedDatasetsChange={setSelectedDatasets}
        showSelectedPanel={showSelectedPanel}
        onCloseSidebar={() => setShowSelectedPanel(false)}
        onReopenSidebar={() => setShowSelectedPanel(true)}
        onChatWithData={handleChatWithData}
        onAddToCollection={handleAddToCollection}
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
