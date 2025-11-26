"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Browse from "@/components/Browse/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout/DashboardLayout";
import { useCollections } from "@/contexts/CollectionsContext";
import { mockDatasets } from "@/data/dataset";
import { getNavigationUrl } from "@/lib/utils";

export default function BrowsePage() {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const router = useRouter();

  // Set mounted to true after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load selected datasets from localStorage only after component mounts
  useEffect(() => {
    if (isMounted) {
      // Non-chat page: always clear saved selection to avoid leakage
      localStorage.removeItem("chatSelectedDatasets");
    }
  }, [isMounted]);

  // Do not persist on selection changes on this page

  const handleChatWithData = () => {
    // Persist only when user explicitly opts to chat
    localStorage.setItem(
      "chatSelectedDatasets",
      JSON.stringify(selectedDatasets),
    );
    router.push(getNavigationUrl("/chat"));
  };

  const handleCloseSidebar = () => {
    setShowSelectedPanel(false);
  };

  const handleReopenSidebar = () => {
    setShowSelectedPanel(true);
  };

  const handleAddToCollection = () => {
    if (selectedDatasets.length === 0) {
      alert("Please select some datasets first");
      return;
    }
    setShowCreateCollectionModal(true);
  };

  const handleCreateCollection = (_name: string) => {
    // Collections are now created via API in the CreateCollectionModal
    // This function is kept for backward compatibility but doesn't do anything
    console.log("Collection creation handled by CreateCollectionModal");
  };

  return (
    <DashboardLayout>
      <div className="relative">
        <Browse
          datasets={mockDatasets}
          title="Browse All Datasets"
          subtitle="List of all datasets"
          showSelectAll={true}
          selectedDatasets={selectedDatasets}
          onSelectedDatasetsChange={setSelectedDatasets}
          showSelectedPanel={showSelectedPanel}
          onCloseSidebar={handleCloseSidebar}
          onReopenSidebar={handleReopenSidebar}
          onChatWithData={handleChatWithData}
          onAddToCollection={handleAddToCollection}
        />

        <CreateCollectionModal
          isVisible={showCreateCollectionModal}
          onClose={() => setShowCreateCollectionModal(false)}
          onCreateCollection={handleCreateCollection}
          selectedDatasets={selectedDatasets}
          datasets={mockDatasets}
        />
      </div>
    </DashboardLayout>
  );
}
