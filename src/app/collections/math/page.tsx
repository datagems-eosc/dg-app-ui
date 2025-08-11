"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import { mockDatasets } from "@/data/mockDatasets";
import { useCollections } from "@/contexts/CollectionsContext";
import { getNavigationUrl } from "@/lib/utils";

export default function MathPage() {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const router = useRouter();
  const { addCollection } = useCollections();

  // Filter datasets to show only Math category
  const mathDatasets = mockDatasets.filter(
    (dataset) => dataset.category === "Math"
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
      JSON.stringify(selectedDatasets)
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

  const handleCreateCollection = (name: string) => {
    addCollection(name, selectedDatasets);
    // Show success message
    alert(
      `Collection "${name}" created successfully with ${selectedDatasets.length} datasets!`
    );
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
