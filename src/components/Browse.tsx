"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search as SearchIcon,
  Filter,
  MessageSquare,
  Database,
  ListChecks,
  Grid2X2,
  MoreHorizontal,
  ArrowRightLeft,
  Edit3,
  Tag,
  Trash2,
} from "lucide-react";
import { Search } from "./ui/Search";
import { Dataset } from "@/data/mockDatasets";
type Collection = { id: string; name: string };
type DatasetWithCollections = Dataset & { collections?: Collection[] };
import DatasetCard from "./DatasetCard";
import DatasetCardSkeleton from "./ui/datasets/DatasetCardSkeleton";
import DatasetDetailsPanel from "./DatasetDetailsPanel";
import SelectedDatasetsPanel from "./SelectedDatasetsPanel";
import FilterModal from "./FilterModal";
import {
  FilterState,
  getDefaultFilters,
  fetchFieldsOfScience,
  fetchLicenses,
  SORTING_OPTIONS,
} from "../config/filterOptions";
import CreateCollectionModal from "./CreateCollectionModal";
import DeleteCollectionModal from "./DeleteCollectionModal";
import { Button } from "./ui/Button";
import Switch from "./ui/Switch";
import { Chip } from "./ui/Chip";
import SortingDropdown from "./SortingDropdown";
import { useRouter } from "next/navigation";
import { HierarchicalCategory } from "./ui/HierarchicalDropdown";
import { useSession } from "next-auth/react";
import { getNavigationUrl } from "@/lib/utils";
import { apiClient } from "@/lib/apiClient";
import { useCollections } from "@/contexts/CollectionsContext";

interface BrowseProps {
  datasets: DatasetWithCollections[];
  title: string;
  subtitle: string;
  showSelectAll?: boolean;
  selectedDatasets?: string[];
  onSelectedDatasetsChange?: (selected: string[]) => void;
  showSelectedPanel?: boolean;
  onCloseSidebar?: () => void;
  onReopenSidebar?: () => void;
  onChatWithData?: () => void;
  onAddToCollection?: () => void;
  isModal?: boolean;
  isEditMode?: boolean;
  onRemoveDataset?: (datasetId: string) => void;
  customActionButtons?: Array<{
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: "primary" | "outline";
    disabled?: boolean;
    className?: string;
  }>;
  showAddButton?: boolean; // NEW PROP
  showSearchAndFilters?: boolean; // NEW PROP
  favoriteDatasetIds?: string[]; // NEW PROP
  favoritesCollectionId?: string; // NEW PROP
  hasFetchedFavorites?: boolean; // NEW PROP
  onAddToFavorites?: (datasetId: string) => Promise<void>; // NEW PROP
  onRemoveFromFavorites?: (datasetId: string) => Promise<void>; // NEW PROP
  /**
   * The current value of the search input (controlled from parent).
   */
  searchTerm?: string;
  /**
   * Handler for when the search input changes (controlled from parent).
   */
  onSearchTermChange?: (value: string) => void;
  /**
   * Handler for when the search is submitted (Enter or button click).
   */
  onSearchTermSubmit?: (searchValue?: string) => void;
  /**
   * Loader state for async dataset fetching (from parent).
   */
  isLoading?: boolean;
  /**
   * Error message for async dataset fetching (from parent).
   */
  error?: string | null;
  /**
   * The current sort value (controlled from parent).
   */
  sortBy?: string;
  /**
   * Handler for when the sort value changes (controlled from parent).
   */
  onSortByChange?: (value: string) => void;
  /**
   * Handler for when filters are applied in the FilterModal.
   */
  onFiltersChange?: (filters: FilterState) => void;
  /**
   * The current filter state (controlled from parent).
   */
  filters?: FilterState;
  /**
   * Whether this is a custom collection page (not browse all datasets).
   */
  isCustomCollection?: boolean;
  /**
   * The name of the current collection (used to determine if it's "Favorites").
   */
  collectionName?: string;
  /**
   * The ID of the current collection (used for delete operations).
   */
  collectionId?: string;
  onApplyFilters?: (filters: FilterState) => void;
  /**
   * Handler for when the collection name is updated.
   */
  onCollectionNameUpdate?: (newName: string) => void;
}

const defaultFilters: FilterState = getDefaultFilters();

// Type guard for API dataset shape
function isApiDataset(obj: unknown): obj is {
  name?: string;
  collections?: { name?: string }[];
  permissions?: string[];
} {
  return typeof obj === "object" && obj !== null;
}

// Helper to safely get a string field from an object
function getApiField(obj: unknown, key: string): string {
  if (
    typeof obj === "object" &&
    obj !== null &&
    key in obj &&
    typeof (obj as Record<string, unknown>)[key] === "string"
  ) {
    return (obj as Record<string, string>)[key];
  }
  return "";
}

export default function Browse({
  datasets,
  title,
  subtitle,
  showSelectAll = false,
  selectedDatasets = [],
  onSelectedDatasetsChange,
  showSelectedPanel = false,
  onCloseSidebar,
  onReopenSidebar,
  onChatWithData,
  onAddToCollection,
  isModal = false,
  isEditMode = false,
  onRemoveDataset,
  customActionButtons,
  showAddButton = true, // default true for backward compatibility
  showSearchAndFilters = true, // Default to true
  favoriteDatasetIds = [], // Default to empty array
  favoritesCollectionId = "", // Default to empty string
  hasFetchedFavorites = false, // Default to false
  onAddToFavorites, // NEW PROP
  onRemoveFromFavorites, // NEW PROP
  searchTerm = "",
  onSearchTermChange,
  onSearchTermSubmit,
  isLoading = false,
  error = null,
  sortBy = "name-asc",
  onSortByChange,
  onApplyFilters,
  filters: propFilters,
  isCustomCollection = false,
  collectionName = "",
  collectionId = "",
  onCollectionNameUpdate,
}: BrowseProps) {
  const { data: session } = useSession() as any;
  const { notifyCollectionModified, refreshExtraCollections } =
    useCollections();
  const router = useRouter();
  const [localSelectedDatasets, setLocalSelectedDatasets] =
    useState<string[]>(selectedDatasets);
  const [selectedDataset, setSelectedDataset] =
    useState<DatasetWithCollections | null>(null);
  const [filters, setFilters] = useState<FilterState>(
    propFilters || defaultFilters
  );
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [datasetsToAdd, setDatasetsToAdd] = useState<DatasetWithCollections[]>(
    []
  );
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<{ value: string; label: string }[]>(
    []
  );
  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [isDetailsPanelAnimating, setIsDetailsPanelAnimating] = useState(false);
  const [isDetailsPanelClosing, setIsDetailsPanelClosing] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showTitleActionsDropdown, setShowTitleActionsDropdown] =
    useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");

  // Use controlled or local state for selected datasets
  const currentSelectedDatasets = onSelectedDatasetsChange
    ? selectedDatasets
    : localSelectedDatasets;
  const setCurrentSelectedDatasets =
    onSelectedDatasetsChange || setLocalSelectedDatasets;

  // Handle delete collection
  const handleDeleteCollection = async () => {
    if (!isCustomCollection || !collectionName || !collectionId) return;

    setIsDeleting(true);
    try {
      const token = (session as any)?.accessToken;
      if (!token) {
        throw new Error("No access token available");
      }

      // Delete the collection via API
      await apiClient.deleteUserCollection(collectionId, token);

      // Force immediate refresh of collections to ensure deleted collection is removed
      // This prevents the issue where deleted collections still appear in the sidebar
      await refreshExtraCollections();

      // Also dispatch a custom event to force immediate sidebar refresh
      window.dispatchEvent(new CustomEvent("forceCollectionsRefresh"));

      // Notify that collections have been modified to refresh sidebar
      notifyCollectionModified();

      // Close the modal and redirect to dashboard
      setShowDeleteModal(false);
      router.push(getNavigationUrl("/dashboard"));
    } catch (error) {
      console.error("Failed to delete collection:", error);
      alert("Failed to delete collection. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle start editing collection name
  const handleStartEditName = () => {
    setIsEditingName(true);
    // Remove "Datasets" suffix if it exists
    const nameWithoutDatasets = collectionName.replace(/\s+Datasets?$/, "");
    setEditingName(nameWithoutDatasets);
    setShowTitleActionsDropdown(false);
  };

  // Handle save collection name
  const handleSaveName = async () => {
    if (
      !editingName.trim() ||
      editingName.trim() === collectionName.replace(/\s+Datasets?$/, "")
    ) {
      setIsEditingName(false);
      return;
    }

    try {
      // TODO: Implement API call to update collection name
      // For now, just update the local state
      console.log("Saving new collection name:", editingName.trim());

      // Call parent handler to update the collection name
      if (onCollectionNameUpdate) {
        onCollectionNameUpdate(editingName.trim());
      }

      // Close edit mode
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update collection name:", error);
      alert("Failed to update collection name. Please try again.");
    }
  };

  // Handle cancel editing collection name
  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditingName("");
  };

  // Set mounted to true after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug logging for props
  useEffect(() => {
    console.log("Browse component props:", {
      isCustomCollection,
      collectionName,
      collectionId,
      shouldShowEllipsis: isCustomCollection && collectionName !== "Favorites",
    });
  }, [isCustomCollection, collectionName, collectionId]);

  // Load viewMode from localStorage only after component mounts
  useEffect(() => {
    if (isMounted) {
      const stored = localStorage.getItem("browseViewMode");
      if (stored && (stored === "grid" || stored === "list")) {
        setViewMode(stored);
      }
    }
  }, [isMounted]);

  // Save viewMode to localStorage whenever it changes (only when mounted)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("browseViewMode", viewMode);
    }
  }, [viewMode, isMounted]);

  // Sync local filters with propFilters when they change
  useEffect(() => {
    if (propFilters) {
      setFilters(propFilters);
    }
  }, [propFilters]);

  // Fetch fields of science and licenses on component mount
  useEffect(() => {
    const token = session?.accessToken;

    fetchFieldsOfScience(token)
      .then((categories) => {
        setFieldsOfScienceCategories(categories);
      })
      .catch((error) => {
        console.error("Error fetching fields of science:", error);
        setFieldsOfScienceCategories([]);
      });

    fetchLicenses(token)
      .then((licenseOptions) => {
        setLicenses(licenseOptions);
      })
      .catch((error) => {
        console.error("Error fetching licenses:", error);
        setLicenses([]);
      });
  }, [session]);

  // Animate SelectedDatasetsPanel on open
  useEffect(() => {
    if (showSelectedPanel) {
      setIsPanelAnimating(true);
      const t = setTimeout(() => setIsPanelAnimating(false), 50);
      return () => clearTimeout(t);
    }
  }, [showSelectedPanel]);

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click target is within the dropdown containers
      const target = event.target as Element;

      // Check if click is within title actions dropdown
      if (showTitleActionsDropdown) {
        const titleDropdownContainer = document.querySelector(
          "[data-title-actions-dropdown]"
        );
        if (
          titleDropdownContainer &&
          !titleDropdownContainer.contains(target)
        ) {
          setShowTitleActionsDropdown(false);
        }
      }

      // Check if click is within actions dropdown
      if (showActionsDropdown) {
        const actionsDropdownContainer = document.querySelector(
          "[data-actions-dropdown]"
        );
        if (
          actionsDropdownContainer &&
          !actionsDropdownContainer.contains(target)
        ) {
          setShowActionsDropdown(false);
        }
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showActionsDropdown, showTitleActionsDropdown]);

  const handleOpenPanel = () => {
    if (!showSelectedPanel) {
      setIsPanelAnimating(true);
      if (onReopenSidebar) {
        onReopenSidebar();
      }
      setTimeout(() => setIsPanelAnimating(false), 50);
    }
  };

  const handleClosePanel = () => {
    setIsPanelClosing(true);
    setTimeout(() => {
      if (onCloseSidebar) {
        onCloseSidebar();
      }
      setIsPanelClosing(false);
    }, 500);
  };

  const handleCloseDetailsPanel = () => {
    setIsDetailsPanelClosing(true);
    setTimeout(() => {
      setSelectedDataset(null);
      setIsDetailsPanelClosing(false);
    }, 500);
  };

  // Only apply access filter on frontend, all other filtering is done on backend
  const filteredDatasets = useMemo(() => {
    return datasets.filter((dataset) => {
      // Only apply access filter on frontend
      if (filters.access && filters.access !== "") {
        const access =
          typeof dataset.access === "string"
            ? dataset.access
            : isApiDataset(dataset) &&
                Array.isArray(
                  (dataset as unknown as Record<string, unknown>).permissions
                ) &&
                (
                  (dataset as unknown as Record<string, unknown>)
                    .permissions as string[]
                ).includes("browsedataset")
              ? "Open Access"
              : "Restricted";
        const isOpen = access === "Open Access";
        if (filters.access === "open" && !isOpen) return false;
        if (filters.access === "restricted" && isOpen) return false;
      }
      return true;
    });
  }, [datasets, filters.access, propFilters]);

  const selectAll = () => {
    const allIds = filteredDatasets.map((d) => d.id);
    setCurrentSelectedDatasets(allIds);
  };

  const deselectAll = () => {
    setCurrentSelectedDatasets([]);
  };

  const toggleSelectAll = () => {
    const allIds = filteredDatasets.map((d) => d.id);
    const allSelected =
      allIds.length > 0 &&
      allIds.every((id) => currentSelectedDatasets.includes(id));

    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  // Check if all filtered datasets are selected
  const allFilteredSelected = useMemo(() => {
    const allIds = filteredDatasets.map((d) => d.id);
    return (
      allIds.length > 0 &&
      allIds.every((id) => currentSelectedDatasets.includes(id))
    );
  }, [filteredDatasets, currentSelectedDatasets]);

  const handleDatasetClick = (dataset: DatasetWithCollections) => {
    if (!isModal) {
      // Close selected datasets panel when opening details panel
      if (showSelectedPanel && onCloseSidebar) {
        onCloseSidebar();
      }

      // Toggle the details panel - close if same dataset clicked, open if different
      if (selectedDataset?.id === dataset.id) {
        handleCloseDetailsPanel();
      } else {
        // If a different dataset is already selected, close it first then open the new one
        if (selectedDataset) {
          handleCloseDetailsPanel();
          // Wait for close animation to complete, then open new panel
          setTimeout(() => {
            setSelectedDataset(dataset);
            setIsDetailsPanelAnimating(true);
            setTimeout(() => setIsDetailsPanelAnimating(false), 50);
          }, 500);
        } else {
          // No dataset selected, open directly with animation
          setSelectedDataset(dataset);
          setIsDetailsPanelAnimating(true);
          setTimeout(() => setIsDetailsPanelAnimating(false), 50);
        }
      }
    }
  };

  const closeDetailsPanel = () => {
    handleCloseDetailsPanel();
  };

  const handleDatasetSelect = (datasetId: string, isSelected: boolean) => {
    // Close details panel when selecting datasets
    if (selectedDataset) {
      handleCloseDetailsPanel();
    }

    if (isSelected) {
      setCurrentSelectedDatasets([...currentSelectedDatasets, datasetId]);
      // Open the SelectedDatasetsPanel when a dataset is selected
      handleOpenPanel();
    } else {
      setCurrentSelectedDatasets(
        currentSelectedDatasets.filter((id) => id !== datasetId)
      );
    }
  };

  const handleApplyFilters = (newFilters: FilterState) => {
    if (onApplyFilters) {
      onApplyFilters(newFilters);
    }
    setFilters(newFilters);
    setShowFilterModal(false);
  };

  const handleAddToCollection = (dataset: DatasetWithCollections) => {
    setDatasetsToAdd([dataset]);
    setShowCreateCollectionModal(true);
  };

  const removeFilter = (filterKey: keyof FilterState) => {
    const newFilters = { ...filters };

    // Reset the specific filter
    if (filterKey === "access") {
      newFilters.access = "";
    } else if (filterKey === "creationYear") {
      newFilters.creationYear = { start: "", end: "" };
    } else if (filterKey === "datasetSize") {
      newFilters.datasetSize = { start: "", end: "" };
    } else if (filterKey === "fieldsOfScience") {
      newFilters.fieldsOfScience = [];
    } else if (filterKey === "license") {
      newFilters.license = [];
    }

    // Update local state
    setFilters(newFilters);

    // Trigger backend refetch by calling onApplyFilters
    if (onApplyFilters) {
      onApplyFilters(newFilters);
    }
  };

  // Generate active filter tags
  const activeFilterTags = useMemo(() => {
    const tags = [];

    if (filters.access && filters.access !== "") {
      tags.push({
        key: "access",
        label: "Access",
        value: filters.access === "open" ? "Open" : "Restricted",
      });
    }

    if (filters.creationYear.start || filters.creationYear.end) {
      const from = filters.creationYear.start || "...";
      const to = filters.creationYear.end || "...";
      tags.push({
        key: "creationYear",
        label: "Creation Year",
        value: `${from}-${to}`,
      });
    }

    if (filters.datasetSize.start || filters.datasetSize.end) {
      const min = filters.datasetSize.start
        ? `${filters.datasetSize.start} MB`
        : "0 MB";
      const max = filters.datasetSize.end
        ? `${filters.datasetSize.end} MB`
        : "∞";

      tags.push({
        key: "datasetSize",
        label: "Dataset Size",
        value: `${min} - ${max}`,
      });
    }

    if (filters.fieldsOfScience.length > 0) {
      // Get the exact names of selected fields of science
      const selectedFieldNames = filters.fieldsOfScience.map((fieldCode) => {
        for (const category of fieldsOfScienceCategories) {
          const option = category.options.find(
            (opt) => opt.value === fieldCode
          );
          if (option) {
            return option.label;
          }
        }
        return fieldCode; // fallback to code if not found
      });

      // If more than 2 fields selected, show first 2 + count of remaining
      if (selectedFieldNames.length > 2) {
        const firstTwo = selectedFieldNames.slice(0, 2).join(", ");
        const remaining = selectedFieldNames.length - 2;
        tags.push({
          key: "fieldsOfScience",
          label: "Field of Science",
          value: `${firstTwo} +${remaining} more`,
        });
      } else {
        tags.push({
          key: "fieldsOfScience",
          label: "Field of Science",
          value: selectedFieldNames.join(", "),
        });
      }
    }

    if (filters.license.length > 0) {
      // Get the exact names of selected licenses
      const selectedLicenseNames = filters.license.map((licenseCode) => {
        const licenseOption = licenses.find((opt) => opt.value === licenseCode);
        return licenseOption ? licenseOption.label : licenseCode; // fallback to code if not found
      });

      // If more than 2 licenses selected, show first 2 + count of remaining
      if (selectedLicenseNames.length > 2) {
        const firstTwo = selectedLicenseNames.slice(0, 2).join(", ");
        const remaining = selectedLicenseNames.length - 2;
        tags.push({
          key: "license",
          label: "License",
          value: `${firstTwo} +${remaining} more`,
        });
      } else {
        tags.push({
          key: "license",
          label: "License",
          value: selectedLicenseNames.join(", "),
        });
      }
    }

    return tags;
  }, [filters, propFilters, fieldsOfScienceCategories, licenses]);

  const isPanelVisible = showSelectedPanel || isPanelClosing;
  const isDetailsPanelVisible = selectedDataset || isDetailsPanelClosing;

  return (
    <div className="flex relative min-h-screen">
      <div
        className={`flex-1 transition-all duration-500 ease-out ${
          isPanelVisible
            ? "sm:pr-[388px]"
            : isDetailsPanelVisible
              ? "sm:pr-[384px]"
              : ""
        }`}
      >
        <div className="max-w-5xl mx-auto relative transition-all duration-500 ease-out px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              {isEditingName ? (
                // Inline editing mode
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveName();
                        } else if (e.key === "Escape") {
                          handleCancelEditName();
                        }
                      }}
                      className="w-full px-3 py-2 text-H2-32-semibold text-gray-750 bg-gray-100 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter collection name"
                      autoFocus
                    />
                    <p className="text-body-16-regular text-gray-650 mt-1">
                      {subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEditName}
                      className="px-4 py-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveName}
                      disabled={
                        !editingName.trim() ||
                        editingName.trim() ===
                          collectionName.replace(/\s+Datasets?$/, "")
                      }
                      className="px-4 py-2"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                // Normal display mode
                <>
                  <h1 className="text-H2-32-semibold text-gray-750">{title}</h1>
                  <p className="text-body-16-regular text-gray-650 mt-1">
                    {subtitle}
                  </p>
                </>
              )}
            </div>
            {/* Right side buttons - hide when editing */}
            {!isEditingName && (
              <div className="flex items-center gap-3">
                {/* Actions dropdown button - only show on custom collection pages, not on Favorites */}
                {isCustomCollection && collectionName !== "Favorites" && (
                  <div className="relative" data-title-actions-dropdown>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowTitleActionsDropdown(!showTitleActionsDropdown)
                      }
                      className="p-2 min-w-0 w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-50"
                    >
                      <MoreHorizontal className="w-4 h-4 text-icon" />
                    </Button>

                    {/* Actions dropdown menu */}
                    {showTitleActionsDropdown && (
                      <div
                        data-title-actions-dropdown
                        className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowTitleActionsDropdown(false);
                            // Select all datasets logic
                            console.log("Select All clicked");
                            selectAll();
                            // Open the selected datasets panel when selecting all
                            handleOpenPanel();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-icon" />
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowTitleActionsDropdown(false);
                            // Rename logic
                            console.log("Rename clicked");
                            handleStartEditName();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Tag className="w-4 h-4 text-icon" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("Delete collection clicked!");
                            setShowTitleActionsDropdown(false);
                            setShowDeleteModal(true);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-icon" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* Custom Action Buttons */}
                {customActionButtons &&
                  customActionButtons.map((button, index) => (
                    <Button
                      key={index}
                      variant={button.variant || "outline"}
                      size="sm"
                      onClick={button.onClick}
                      disabled={button.disabled}
                      className={`flex items-center gap-2 ${button.className || ""}`}
                    >
                      {button.icon && (
                        <button.icon className="w-4 h-4 text-icon" />
                      )}
                      {button.label}
                    </Button>
                  ))}
                {/* Selected datasets counter - clickable when sidebar is closed */}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (showSelectedPanel) handleClosePanel();
                    else handleOpenPanel();
                  }}
                  className="flex items-center gap-2 transition-all duration-200"
                >
                  <Database className="w-4 h-4 text-icon" />
                  {currentSelectedDatasets.length} Selected
                </Button>
                {/* Actions dropdown button */}
                {currentSelectedDatasets.length > 0 && (
                  <div className="relative" data-actions-dropdown>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowActionsDropdown(!showActionsDropdown)
                      }
                      className="p-2 min-w-0 w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-50"
                    >
                      <MoreHorizontal className="w-4 h-4 text-icon" />
                    </Button>

                    {/* Actions dropdown menu */}
                    {showActionsDropdown && (
                      <div
                        data-actions-dropdown
                        className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowActionsDropdown(false);
                            // Select all datasets logic
                            console.log(
                              "Select All clicked (selected datasets)"
                            );
                            selectAll();
                            // Open the selected datasets panel when selecting all
                            handleOpenPanel();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-icon" />
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowActionsDropdown(false);
                            // Edit logic
                            console.log("Edit clicked (selected datasets)");
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Edit3 className="w-4 h-4 text-icon" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowActionsDropdown(false);
                            // Rename logic
                            console.log("Rename clicked (selected datasets)");
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Tag className="w-4 h-4 text-icon" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowActionsDropdown(false);
                            // Delete logic
                            console.log("Delete clicked (selected datasets)");
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-icon" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* {showSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="min-w-[100px]"
            >
              {allFilteredSelected ? "Deselect All" : "Select All"}
            </Button>
          )} */}
          </div>

          {/* Search and filters */}
          {showSearchAndFilters !== false && (
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <Search
                  placeholder="Search datasets..."
                  value={searchTerm}
                  onChange={onSearchTermChange}
                  onSearch={(value) =>
                    onSearchTermSubmit && onSearchTermSubmit(value)
                  }
                  onClear={() => {
                    if (onSearchTermChange) {
                      onSearchTermChange("");
                    }
                    if (onSearchTermSubmit) {
                      onSearchTermSubmit("");
                    }
                  }}
                />
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-1.5"
                onClick={() => setShowFilterModal(true)}
              >
                <Filter className="w-4 h-4 text-icon" />
                Filter
              </Button>
              <Switch
                leftIcon={ListChecks}
                rightIcon={Grid2X2}
                value={viewMode === "grid" ? "right" : "left"}
                onChange={(value) =>
                  setViewMode(value === "right" ? "grid" : "list")
                }
              />
            </div>
          )}

          {/* Active Filters */}
          {showSearchAndFilters !== false && activeFilterTags.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {activeFilterTags.map((tag) => (
                <Chip
                  key={tag.key}
                  color="grey"
                  onRemove={() => removeFilter(tag.key as keyof FilterState)}
                >
                  <span className="text-descriptions-12-medium text-gray-650">
                    {tag.label}:
                  </span>
                  <span className="text-descriptions-12-medium ml-1 text-gray-750">
                    {tag.value}
                  </span>
                </Chip>
              ))}
            </div>
          )}

          {/* Results count and sorting */}
          {showSearchAndFilters !== false && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-body-14-regular text-gray-650">
                Showing:{" "}
                <span className="text-body-14-medium text-gray-750">
                  {filteredDatasets.length}{" "}
                  {filteredDatasets.length === 1 ? "result" : "results"}
                </span>
              </p>
              <SortingDropdown
                value={sortBy}
                onChange={(value) => onSortByChange && onSortByChange(value)}
                options={SORTING_OPTIONS}
                triggerLabel="Sorting"
              />
            </div>
          )}

          {/* Main content area - do not shift cards when modal is open */}
          <div className="transition-all duration-300">
            {/* Loader or error */}
            {isLoading ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                    : "grid grid-cols-1 gap-4"
                }
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <DatasetCardSkeleton key={index} viewMode={viewMode} />
                ))}
              </div>
            ) : error ? (
              <div className="text-red-600 text-center py-8">{error}</div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                    : "grid grid-cols-1 gap-4"
                }
              >
                {filteredDatasets.map((dataset) => (
                  <DatasetCard
                    key={dataset.id}
                    dataset={dataset}
                    onClick={() => handleDatasetClick(dataset)}
                    isSelected={selectedDataset?.id === dataset.id}
                    isMultiSelected={currentSelectedDatasets.includes(
                      dataset.id
                    )}
                    onSelect={(isSelected) =>
                      handleDatasetSelect(dataset.id, isSelected)
                    }
                    showSelectButton={true}
                    isEditMode={isEditMode}
                    onRemove={
                      isEditMode && onRemoveDataset
                        ? () => onRemoveDataset(dataset.id)
                        : undefined
                    }
                    viewMode={viewMode}
                    onAddToCollection={() => handleAddToCollection(dataset)}
                    showAddButton={showAddButton}
                    isFavorite={favoriteDatasetIds.includes(dataset.id)}
                    favoritesCollectionId={favoritesCollectionId}
                    onAddToFavorites={onAddToFavorites}
                    hasFetchedFavorites={hasFetchedFavorites}
                    onRemoveFromFavorites={onRemoveFromFavorites}
                    hasSidePanelOpen={
                      (!!selectedDataset && !isDetailsPanelClosing) ||
                      (showSelectedPanel && !isPanelClosing)
                    }
                  />
                ))}
              </div>
            )}
            {/* Empty state */}
            {!isLoading && !error && filteredDatasets.length === 0 && (
              <div className="text-center py-18 space-y-2">
                <SearchIcon className="w-10 h-10 mx-auto text-slate-350" />
                <h3 className="text-body-16-semibold text-slate-850">
                  No datasets found matching your search criteria.
                </h3>
                <p className="text-body-14-regular text-gray-650">
                  Try rephrasing your question or using different keywords.
                </p>
              </div>
            )}
          </div>

          {/* Dataset Details Panel */}
          {!isModal && (isDetailsPanelVisible || isDetailsPanelClosing) && (
            <div className="fixed right-0 bottom-0 top-18 z-40 w-full sm:w-[380px] will-change-transform pointer-events-none">
              <div
                className={`h-full transition-transform duration-500 ease-out pointer-events-auto ${
                  isDetailsPanelAnimating
                    ? "translate-x-full"
                    : isDetailsPanelClosing
                      ? "translate-x-full"
                      : "translate-x-0"
                }`}
              >
                <DatasetDetailsPanel
                  dataset={selectedDataset}
                  onClose={closeDetailsPanel}
                  isVisible={!!selectedDataset}
                  onAddToCollection={
                    selectedDataset
                      ? () => handleAddToCollection(selectedDataset)
                      : undefined
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isVisible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />

      {/* Create Collection Modal */}
      <CreateCollectionModal
        isVisible={showCreateCollectionModal}
        onClose={() => {
          setShowCreateCollectionModal(false);
          setDatasetsToAdd([]);
        }}
        onCreateCollection={(name: string) => {
          // This will be handled by the modal itself
          setShowCreateCollectionModal(false);
          setDatasetsToAdd([]);
        }}
        selectedDatasets={datasetsToAdd.map((d) => d.id)}
        datasets={datasets}
      />

      {/* Delete Collection Modal */}
      <DeleteCollectionModal
        isVisible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCollection}
        collectionName={collectionName}
        isLoading={isDeleting}
      />
      {/* Selected Datasets Panel (right side, under header similar to Chat) */}
      {(showSelectedPanel || isPanelClosing) && (
        <div className="fixed right-0 bottom-0 top-18 z-40 w-full sm:w-[380px] will-change-transform pointer-events-none">
          <div
            className={`h-full transition-transform duration-500 ease-out pointer-events-auto ${
              isPanelAnimating
                ? "translate-x-full"
                : isPanelClosing
                  ? "translate-x-full"
                  : "translate-x-0"
            }`}
          >
            <SelectedDatasetsPanel
              selectedDatasetIds={currentSelectedDatasets}
              datasets={datasets}
              onRemoveDataset={(id: string) => handleDatasetSelect(id, false)}
              onChatWithData={onChatWithData}
              onClose={handleClosePanel}
              onAddToCollection={onAddToCollection}
              onDeselectAll={() => setCurrentSelectedDatasets([])}
            />
          </div>
        </div>
      )}
    </div>
  );
}
