"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Edit3, Plus, Save, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import AddDatasetsModal from "@/components/AddDatasetsModal";
import { mockDatasets } from "@/data/dataset";
import { useCollections } from "@/contexts/CollectionsContext";
import { getNavigationUrl } from "@/lib/utils";

export default function CustomCollectionPage() {
  const router = useRouter();
  const params = useParams();
  const {
    collections,
    extraCollections,
    addCollection,
    updateCollection,
    removeCollection,
    notifyCollectionModified,
  } = useCollections();

  // All useState and useEffect hooks must be called before any early return
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [showAddDatasetsModal, setShowAddDatasetsModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDatasetIds, setEditedDatasetIds] = useState<string[]>([]);

  useEffect(() => {
    // Non-chat page: always clear saved selection to avoid leakage
    localStorage.removeItem("chatSelectedDatasets");
    setIsLoaded(true); // Mark as loaded
  }, []);

  // Do not persist selections by default on this page

  // Now, after all hooks, add the guard clause
  if (!params || !params.id) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96 p-6">
          <div className="text-center">
            <h1 className="text-H2-24-semibold text-gray-900 mb-2">
              Collection Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              The collection you&apos;re looking for doesn&apos;t exist.
            </p>
            <button
              onClick={() => router.push(getNavigationUrl("/browse"))}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Go to Browse
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const collectionId = params.id as string;
  // Look for collection in both local collections and API collections
  const localCollection = collections.find((c) => c.id === collectionId);
  const apiCollection = extraCollections.find((c) => c.id === collectionId);
  const collection = apiCollection || localCollection;

  // Filter datasets to show only those in this collection (or edited collection in edit mode)
  const displayDatasetIds = isEditMode
    ? editedDatasetIds
    : collection?.datasetIds || [];
  const collectionDatasets = mockDatasets.filter((dataset) =>
    displayDatasetIds.includes(dataset.id)
  );

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
    alert(
      `Collection "${name}" created successfully with ${selectedDatasets.length} datasets!`
    );
  };

  const handleEditClick = () => {
    if (!collection) return;
    setIsEditMode(true);
    setEditedName(collection.name);
    setEditedDatasetIds(
      collection.datasetIds ? [...collection.datasetIds] : []
    );
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedName("");
    setEditedDatasetIds([]);
  };

  const handleSaveChanges = () => {
    if (!collection || !editedName.trim()) return;

    updateCollection(collection.id, {
      name: editedName.trim(),
      datasetIds: editedDatasetIds,
    });

    setIsEditMode(false);
    alert("Collection updated successfully!");
  };

  const handleRemoveDataset = (datasetId: string) => {
    setEditedDatasetIds((prev) => prev.filter((id) => id !== datasetId));
  };

  const handleAddDatasetsFromModal = (newSelectedDatasets: string[]) => {
    // Add any new datasets that aren't already in the collection
    const datasetsToAdd = newSelectedDatasets.filter(
      (id) => !editedDatasetIds.includes(id)
    );
    setEditedDatasetIds((prev) => [...prev, ...datasetsToAdd]);
  };

  const handleDeleteCollection = () => {
    if (!collection) return;
    if (
      confirm(
        `Are you sure you want to delete "${collection.name}"? This action cannot be undone.`
      )
    ) {
      removeCollection(collection.id);
      // Notify that collections have been modified to refresh sidebar
      notifyCollectionModified();
      router.push(getNavigationUrl("/browse"));
    }
  };

  // Custom action buttons for the Browse component
  const getCustomActionButtons = () => {
    if (isEditMode) {
      return [
        {
          label: "Add Datasets",
          icon: Plus,
          onClick: () => setShowAddDatasetsModal(true),
          variant: "outline" as const,
        },
        {
          label: "Delete Collection",
          icon: Trash2,
          onClick: handleDeleteCollection,
          variant: "outline" as const,
          className: "text-red-600 border-red-300 hover:bg-red-50",
        },
        {
          label: "Cancel",
          onClick: handleCancelEdit,
          variant: "outline" as const,
        },
        {
          label: "Save Changes",
          icon: Save,
          onClick: handleSaveChanges,
          disabled: !editedName.trim(),
          variant: "primary" as const,
        },
      ];
    } else {
      return [
        {
          label: "Edit Collection",
          icon: Edit3,
          onClick: handleEditClick,
          variant: "outline" as const,
        },
      ];
    }
  };

  // If collection doesn't exist, show error
  if (!collection) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96 p-6">
          <div className="text-center">
            <h1 className="text-H2-24-semibold text-gray-900 mb-2">
              Collection Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              The collection you&apos;re looking for doesn&apos;t exist.
            </p>
            <button
              onClick={() => router.push(getNavigationUrl("/browse"))}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Go to Browse
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative p-6">
        {/* Custom Header */}
        <div className="mb-6">
          {isEditMode ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-H2-24-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 mb-2 w-full"
              autoFocus
            />
          ) : (
            <h1 className="text-H2-24-semibold text-gray-900">
              {collection.name}
            </h1>
          )}
          <p className="text-gray-600 mt-1">
            Custom collection • {displayDatasetIds.length} datasets
            {"createdAt" in collection && collection.createdAt ? (
              <>
                {" "}
                • Created {(collection.createdAt as Date).toLocaleDateString()}
              </>
            ) : (
              <> - </>
            )}
          </p>
        </div>

        <Browse
          datasets={collectionDatasets}
          title=""
          subtitle=""
          showSelectAll={!isEditMode}
          selectedDatasets={selectedDatasets}
          onSelectedDatasetsChange={setSelectedDatasets}
          showSelectedPanel={showSelectedPanel}
          onCloseSidebar={handleCloseSidebar}
          onReopenSidebar={handleReopenSidebar}
          onChatWithData={!isEditMode ? handleChatWithData : undefined}
          onAddToCollection={handleAddToCollection}
          isEditMode={isEditMode}
          onRemoveDataset={isEditMode ? handleRemoveDataset : undefined}
          customActionButtons={getCustomActionButtons()}
          isCustomCollection={true}
          collectionName={collection.name}
          collectionId={collection.id}
        />

        <CreateCollectionModal
          isVisible={showCreateCollectionModal}
          onClose={() => setShowCreateCollectionModal(false)}
          onCreateCollection={handleCreateCollection}
          selectedDatasets={selectedDatasets}
          datasets={mockDatasets}
        />

        <AddDatasetsModal
          isVisible={showAddDatasetsModal}
          onClose={() => setShowAddDatasetsModal(false)}
          datasets={mockDatasets}
          onSelectedDatasetsChange={handleAddDatasetsFromModal}
        />
      </div>
    </DashboardLayout>
  );
}
