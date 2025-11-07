"use client";

import { FileText, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { useCollections } from "@/contexts/CollectionsContext";
import type { Dataset } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";

interface CreateCollectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateCollection?: (name: string) => void;
  selectedDatasets: string[];
  datasets: Dataset[];
}

type TabType = "create" | "add";

export default function CreateCollectionModal({
  isVisible,
  onClose,
  onCreateCollection,
  selectedDatasets,
  datasets,
}: CreateCollectionModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("add");
  const [collectionName, setCollectionName] = useState("Custom Collection");
  const [description, setDescription] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const {
    extraCollections,
    refreshExtraCollections,
    notifyCollectionModified,
  } = useCollections();
  const api = useApi();
  const router = useRouter();

  const _selectedDatasetObjects = datasets.filter((dataset) =>
    selectedDatasets.includes(dataset.id),
  );

  // Use API-fetched custom collections (same as sidebar), excluding Favorites
  const customCollections = (extraCollections || []).filter(
    (collection) => collection.name !== "Favorites",
  );

  // Refresh collections when modal opens or token is available to ensure fresh data
  useEffect(() => {
    if (isVisible && api.hasToken) {
      // Always refresh collections when modal opens or token is available to ensure fresh data
      refreshExtraCollections();
    }
  }, [isVisible, api.hasToken, refreshExtraCollections]);

  // Handle tab switching with collection refresh
  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    // If switching to "Add to existing" tab, refresh collections to ensure fresh data
    if (tab === "add" && api.hasToken) {
      refreshExtraCollections();
    }
  };

  const handleCreate = async () => {
    if (!collectionName.trim()) return;

    if (!api.hasToken) {
      alert("Please log in to create collections");
      return;
    }

    setIsCreating(true);
    try {
      // Create collection via API
      const response = await api.createUserCollection(collectionName.trim());

      if (response.id) {
        // Create a proper collection object with the real ID
        const newCollection = {
          id: response.id,
          name: response.name || collectionName.trim(),
          datasetIds: selectedDatasets,
          createdAt: new Date(),
          icon: "📁",
        };

        // Don't add to local state - let the API handle it
        // The sidebar will show collections fetched from the API

        // Refresh the sidebar to show the newly created collection
        await refreshExtraCollections();
        notifyCollectionModified();

        if (onCreateCollection) {
          onCreateCollection(collectionName.trim());
        }

        setCollectionName("Custom Collection");
        setDescription("");

        onClose();

        router.push(`/dashboard?collection=${response.id}&isCustom=true`);
      }
    } catch (error) {
      console.error("Failed to create collection:", error);
      alert("Failed to create collection. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddToCollections = async () => {
    if (selectedCollectionIds.length === 0) return;

    if (!api.hasToken) {
      alert("Please log in to add datasets to collections");
      return;
    }

    setIsAdding(true);
    try {
      // Add datasets to all selected collections via API
      for (const collectionId of selectedCollectionIds) {
        for (const datasetId of selectedDatasets) {
          await api.addDatasetToUserCollection(collectionId, datasetId);
        }
      }

      // Reset selection
      setSelectedCollectionIds([]);

      // Close modal first
      onClose();

      // Then refresh custom collections in sidebar from API
      await refreshExtraCollections();
      // Also notify that collections have been modified to refresh sidebar
      notifyCollectionModified();
    } catch (error) {
      console.error("Failed to add datasets to collections:", error);
      alert("Failed to add datasets to collections. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setCollectionName("Custom Collection");
    setDescription("");
    setSelectedCollectionIds([]);
    // Don't reset the activeTab - keep user's preference
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (activeTab === "create") {
        handleCreate();
      } else {
        handleAddToCollections();
      }
    }
  };

  const handleCollectionToggle = (collectionId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId],
    );
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-[95%] md:max-w-[550px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.25 border-b border-slate-200">
          <h2 className="text-H6-18-semibold text-slate-850">Collections</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X strokeWidth={1.25} className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 rounded-[40px] p-1">
            <button
              onClick={() => handleTabSwitch("create")}
              className={`flex-1 py-2.5 px-4 rounded-[40px] text-body-16-regular transition-colors ${
                activeTab === "create"
                  ? "bg-white text-gray-750"
                  : "text-gray-650 hover:text-gray-950 cursor-pointer"
              }`}
            >
              Create New
            </button>
            <button
              onClick={() => handleTabSwitch("add")}
              className={`flex-1 py-2.5 px-4 rounded-[40px] text-body-16-regular transition-colors ${
                activeTab === "add"
                  ? "bg-white text-gray-750"
                  : "text-gray-650 hover:text-gray-950 cursor-pointer"
              }`}
            >
              Add to existing
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div
          className={`flex-1 min-h-0 px-6 pt-6 ${activeTab === "create" ? "pb-25" : "pb-3.75"}`}
        >
          {activeTab === "create" ? (
            // Create New Tab
            <>
              {/* Collection Name Input */}
              <div className="mb-6">
                <Input
                  name="collection-name"
                  label="Collection name"
                  size="large"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                />
              </div>

              {/* Description Input */}
              <Input
                name="collection-description"
                label="Description (Optional)"
                size="large"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
              />
            </>
          ) : (
            // Add to existing Tab
            <>
              {/* Collection Selection */}
              <div className="mb-6">
                <h3 className="text-body-14-medium text-gray-750 mb-1">
                  Select Collections
                </h3>

                {customCollections.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-icon" />
                    <p className="text-descriptions-12-regular">
                      No custom collections found.
                    </p>
                    <p className="text-descriptions-12-regular mt-1">
                      Create a collection first to add datasets.
                    </p>
                  </div>
                ) : (
                  <div className="p-2 border border-slate-350 rounded-lg overflow-auto max-h-[188px]">
                    <div className="flex flex-col gap-1">
                      {customCollections.map((collection) => {
                        const isSelected = selectedCollectionIds.includes(
                          collection.id,
                        );
                        const itemCount =
                          (collection as any)?.datasetCount ??
                          (collection as any)?.userDatasetCollections?.length ??
                          0;
                        return (
                          <div
                            key={collection.id}
                            onClick={() =>
                              handleCollectionToggle(collection.id)
                            }
                            className={`px-4 py-2.75 flex items-start gap-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                              isSelected ? "bg-white" : "hover:bg-slate-100"
                            }`}
                          >
                            <Checkbox
                              id={`collection-${collection.id}`}
                              checked={isSelected}
                              onChange={() =>
                                handleCollectionToggle(collection.id)
                              }
                              className="shrink-0 pt-1"
                            />
                            <div className="flex flex-col items-start flex-1">
                              <div
                                className={`text-body-16-semibold ${isSelected ? "text-gray-750" : "text-gray-750"}`}
                              >
                                {collection.name}
                              </div>
                              <div className="text-descriptions-12-regular text-icon">{`${itemCount} ${itemCount === 1 ? "item" : "items"}`}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3.75 border-t border-slate-200">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {activeTab === "create" ? (
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!collectionName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Collection"
              )}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleAddToCollections}
              disabled={
                selectedCollectionIds.length === 0 ||
                customCollections.length === 0 ||
                isAdding
              }
            >
              {isAdding ? "Adding..." : "Add to Collection"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
