"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useCollections } from "@/contexts/CollectionsContext";
import { mockDatasets } from "@/data/dataset";
import { getNavigationUrl } from "@/lib/utils";

export default function LifelongLearningPage() {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const router = useRouter();

  // Filter datasets to show only Lifelong Learning category
  const lifelongLearningDatasets = mockDatasets.filter(
    (dataset) => dataset.category === "Lifelong Learning"
  );

  // Load selected datasets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("chatSelectedDatasets");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedDatasets(parsed);
        }
      } catch (error) {
        console.error("Error loading selected datasets:", error);
      }
    }
    setIsLoaded(true); // Mark as loaded
  }, []);

  // Save selected datasets to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(
      "chatSelectedDatasets",
      JSON.stringify(selectedDatasets)
    );
  }, [selectedDatasets, isLoaded]);

  const handleChatWithData = () => {
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
          datasets={lifelongLearningDatasets}
          title="Lifelong Learning Datasets"
          subtitle="Lifelong Learning dataset collection"
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
