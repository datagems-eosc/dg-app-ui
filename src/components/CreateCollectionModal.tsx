"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, FileText, Loader2 } from "lucide-react";
import { Dataset } from "@/data/mockDatasets";
import { useCollections } from "@/contexts/CollectionsContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { Button } from "./ui/Button";

interface CreateCollectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateCollection: (name: string) => void;
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
    []
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const {
    collections,
    extraCollections,
    addCollection,
    addToCollection,
    removeTimestampCollections,
    refreshExtraCollections,
    notifyCollectionModified,
  } = useCollections();
  const { data: session } = useSession();
  const router = useRouter();

  const selectedDatasetObjects = datasets.filter((dataset) =>
    selectedDatasets.includes(dataset.id)
  );

  // Use API-fetched custom collections (same as sidebar), excluding Favorites
  const customCollections = (extraCollections || []).filter(
    (collection) => collection.name !== "Favorites"
  );

  // Refresh collections when modal opens or session changes to ensure fresh data
  useEffect(() => {
    if (isVisible && session) {
      // Always refresh collections when modal opens or session changes to ensure fresh data
      refreshExtraCollections();
    }
  }, [isVisible, session, refreshExtraCollections]);

  // Handle tab switching with collection refresh
  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    // If switching to "Add to existing" tab, refresh collections to ensure fresh data
    if (tab === "add" && session) {
      refreshExtraCollections();
    }
  };

  const handleCreate = async () => {
    if (!collectionName.trim()) return;

    if (!session) {
      alert("Please log in to create collections");
      return;
    }

    setIsCreating(true);
    try {
      const token = (session as any)?.accessToken;
      if (!token) {
        throw new Error("No access token available");
      }

      // Create collection via API
      const response = await apiClient.createUserCollection(
        collectionName.trim(),
        token
      );

      // Add to local state with the real ID from API response
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
        // Also notify that collections have been modified to refresh sidebar
        notifyCollectionModified();

        // Call the original callback if provided
        if (onCreateCollection) {
          onCreateCollection(collectionName.trim());
        }

        // Reset form
        setCollectionName("Custom Collection");
        setDescription("");

        // Close modal
        onClose();

        // Redirect to the dashboard with collection parameters
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

    if (!session) {
      alert("Please log in to add datasets to collections");
      return;
    }

    setIsAdding(true);
    try {
      const token = (session as any)?.accessToken;
      if (!token) {
        throw new Error("No access token available");
      }

      // Add datasets to all selected collections via API
      for (const collectionId of selectedCollectionIds) {
        for (const datasetId of selectedDatasets) {
          await apiClient.addDatasetToUserCollection(
            collectionId,
            datasetId,
            token
          );
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
        : [...prev, collectionId]
    );
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-H2-20-semibold text-gray-900">Collections</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-4">
          <div className="flex bg-gray-100 rounded-2xl p-1">
            <button
              onClick={() => handleTabSwitch("create")}
              className={`flex-1 py-2 px-4 rounded-2xl text-sm font-medium transition-colors ${
                activeTab === "create"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Create New
            </button>
            <button
              onClick={() => handleTabSwitch("add")}
              className={`flex-1 py-2 px-4 rounded-2xl text-sm font-medium transition-colors ${
                activeTab === "add"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Add to existing
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {activeTab === "create" ? (
            // Create New Tab
            <>
              {/* Collection Name Input */}
              <div className="mb-6">
                <label
                  htmlFor="collection-name"
                  className="block text-body-14-medium text-gray-700 mb-2"
                >
                  Collection name
                </label>
                <input
                  id="collection-name"
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  autoFocus
                />
              </div>

              {/* Description Input */}
              <div className="mb-6">
                <label
                  htmlFor="collection-description"
                  className="block text-body-14-medium text-gray-700 mb-2"
                >
                  Description (Optional)
                </label>
                <input
                  id="collection-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                />
              </div>
            </>
          ) : (
            // Add to existing Tab
            <>
              {/* Collection Selection */}
              <div className="mb-6">
                <h3 className="text-body-16-medium text-gray-700 mb-3">
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
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {customCollections.map((collection) => (
                      <label
                        key={collection.id}
                        className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedCollectionIds.includes(collection.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCollectionIds.includes(
                            collection.id
                          )}
                          onChange={() => handleCollectionToggle(collection.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-body-16-semibold text-gray-900">
                              {collection.name}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
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
