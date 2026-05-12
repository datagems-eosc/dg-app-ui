"use client";

import { Toast } from "@ui/Toast";
import { Edit3, Plus, Save, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddDatasetsModal from "@/components/AddDatasetsModal";
import Browse from "@/components/Browse";
import CreateCollectionModal from "@/components/CreateCollectionModal";
import DashboardLayout from "@/components/DashboardLayout";
import { APP_ROUTES } from "@/config/appUrls";
import { TOAST_MESSAGES } from "@/constants/toastMessages.mjs";
import { useCollections } from "@/contexts/CollectionsContext";
import { mockDatasets } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";
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
  const [_isLoaded, setIsLoaded] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [showAddDatasetsModal, setShowAddDatasetsModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDatasetIds, setEditedDatasetIds] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const api = useApi();

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
              onClick={() => router.push(getNavigationUrl(APP_ROUTES.BROWSE))}
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
    displayDatasetIds.includes(dataset.id),
  );

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

  const handleCreateCollection = (name: string) => {
    addCollection(name, selectedDatasets);
    alert(
      `Collection "${name}" created successfully with ${selectedDatasets.length} datasets!`,
    );
  };

  const handleEditClick = () => {
    if (!collection) return;
    setIsEditMode(true);
    setEditedName(collection.name);
    setEditedDatasetIds(
      collection.datasetIds ? [...collection.datasetIds] : [],
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

  const showToastFromConfig = (config: {
    message: string;
    type: "success" | "error";
  }) => {
    setToastType(config.type);
    setToastMessage(config.message);
    setShowToast(true);
  };

  const handleRemoveDataset = async (datasetId: string) => {
    if (!collection?.id) return;
    // Optimistic UI update
    const previousIds = editedDatasetIds;
    setEditedDatasetIds((prev) => prev.filter((id) => id !== datasetId));
    try {
      await api.removeDatasetFromUserCollection(collection.id, datasetId);
      notifyCollectionModified();
      showToastFromConfig(
        TOAST_MESSAGES.datasetRemovedFromCollection(collection.name),
      );
    } catch (error) {
      logError("Failed to remove dataset from collection", error, {
        collectionId: collection.id,
        datasetId,
      });
      // Revert on failure
      setEditedDatasetIds(previousIds);
      showToastFromConfig(TOAST_MESSAGES.datasetRemoveFailed);
    }
  };

  const handleBulkRemoveSelectedDatasets = async (datasetIds: string[]) => {
    if (!collection?.id || datasetIds.length === 0) return;
    const collectionId = collection.id;
    const collectionName = collection.name;

    // Optimistic UI: remove from edited list (used for display in edit mode)
    // and clear selection.
    const previousIds = editedDatasetIds;
    const previousSelection = selectedDatasets;
    const removeSet = new Set(datasetIds);
    setEditedDatasetIds((prev) => prev.filter((id) => !removeSet.has(id)));
    setSelectedDatasets([]);

    const results = await Promise.allSettled(
      datasetIds.map((id) =>
        api.removeDatasetFromUserCollection(collectionId, id),
      ),
    );
    const failures = results
      .map((result, index) => ({ result, datasetId: datasetIds[index] }))
      .filter(({ result }) => result.status === "rejected");

    if (failures.length === 0) {
      notifyCollectionModified();
      showToastFromConfig(
        datasetIds.length === 1
          ? TOAST_MESSAGES.datasetRemovedFromCollection(collectionName)
          : TOAST_MESSAGES.datasetsRemovedFromCollection(
              datasetIds.length,
              collectionName,
            ),
      );
      return;
    }

    failures.forEach(({ result, datasetId }) => {
      if (result.status === "rejected") {
        logError(
          "Failed to remove dataset from collection (bulk)",
          result.reason,
          {
            collectionId,
            datasetId,
          },
        );
      }
    });

    // Revert UI for failed datasets — only their IDs come back
    const failedIds = new Set(failures.map((f) => f.datasetId));
    setEditedDatasetIds((current) => {
      const merged = [...current];
      for (const id of previousIds) {
        if (failedIds.has(id) && !merged.includes(id)) merged.push(id);
      }
      return merged;
    });
    setSelectedDatasets(previousSelection.filter((id) => failedIds.has(id)));

    // Some succeeded — still notify so sidebar refreshes
    if (failures.length < datasetIds.length) {
      notifyCollectionModified();
    }
    showToastFromConfig(TOAST_MESSAGES.datasetRemoveFailed);
  };

  const handleAddDatasetsFromModal = (newSelectedDatasets: string[]) => {
    // Add any new datasets that aren't already in the collection
    const datasetsToAdd = newSelectedDatasets.filter(
      (id) => !editedDatasetIds.includes(id),
    );
    setEditedDatasetIds((prev) => [...prev, ...datasetsToAdd]);
  };

  const handleDeleteCollection = () => {
    if (!collection) return;
    if (
      confirm(
        `Are you sure you want to delete "${collection.name}"? This action cannot be undone.`,
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
              onClick={() => router.push(getNavigationUrl(APP_ROUTES.BROWSE))}
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
        <Browse
          datasets={collectionDatasets}
          title={collection.name}
          subtitle={`Custom collection • ${displayDatasetIds.length} datasets`}
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
          onBulkRemoveDatasets={handleBulkRemoveSelectedDatasets}
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

        <Toast
          message={toastMessage}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
          type={toastType}
        />
      </div>
    </DashboardLayout>
  );
}
