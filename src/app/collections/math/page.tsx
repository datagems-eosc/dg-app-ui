"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useCollections } from "@/contexts/CollectionsContext";
import { mockDatasets } from "@/data/dataset";
import { getNavigationUrl } from "@/lib/utils";

export default function MathPage() {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [_isLoaded, setIsLoaded] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const router = useRouter();

  // Filter datasets to show only Math category
  const mathDatasets = mockDatasets.filter(
    (dataset) => dataset.category === "Math",
  );

  // On mount: clear any previous chat selection as this is not the chat page
  useEffect(() => {
    localStorage.removeItem("chatSelectedDatasets");
    setIsLoaded(true); // Mark as loaded
  }, []);

  // Do not persist selections by default on this page

  const handleChatWithData = () => {
    // Persist only when user explicitly opts to chat
    localStorage.setItem(
      "chatSelectedDatasets",
      JSON.stringify(selectedDatasets),
    );
    router.push(getNavigationUrl("/chat"));
  };

  const handleReopenSidebar = () => {
    setShowSelectedPanel(true);
  };

  const handleCloseSidebar = () => {
    setShowSelectedPanel(false);
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
      <div className="relative p-6">
        <Browse
          datasets={mathDatasets}
          title="Math Datasets"
          subtitle="Math dataset collection"
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
