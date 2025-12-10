"use client";

import { Search } from "@ui/Search";
import {
  ArrowRightLeft,
  Database,
  Edit3,
  Filter,
  Grid2X2,
  ListChecks,
  MoreHorizontal,
  Search as SearchIcon,
  Tag,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

type Collection = { id: string; name: string };
type DatasetWithCollections = Dataset & { collections?: Collection[] };

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import DatasetCardSkeleton from "@ui/datasets/DatasetCardSkeleton";
import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import SmartSearch from "@ui/SmartSearch";
import SmartSearchExamples from "@ui/SmartSearchExamples";
import Switch from "@ui/Switch";
import { Toast } from "@ui/Toast";
import { useRouter } from "next/navigation";
import { useCollections } from "@/contexts/CollectionsContext";
import type { Dataset } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import logger, { logApiError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import {
  type FilterState,
  getDefaultFilters,
  processFieldsOfScience,
  processLicenses,
  SORTING_OPTIONS,
} from "../../config/filterOptions";
import CreateCollectionModal from "../CreateCollectionModal";
import DatasetCard from "../DatasetCard";
import DeleteCollectionModal from "../DeleteCollectionModal";
import FilterModal from "../FilterModal";
import SelectedDatasetsPanel from "../SelectedDatasetsPanel";
import SortingDropdown from "../SortingDropdown";

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
  /**
   * Controlled smart search toggle from parent (DashboardClient)
   */
  isSmartSearchEnabled?: boolean;
  onSmartSearchToggle?: (enabled: boolean) => void;
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
function _getApiField(obj: unknown, key: string): string {
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
  isSmartSearchEnabled: controlledSmartSearchEnabled,
  onSmartSearchToggle,
}: BrowseProps) {
  const api = useApi();
  const { notifyCollectionModified, refreshExtraCollections } =
    useCollections();
  const router = useRouter();
  const [localSelectedDatasets, setLocalSelectedDatasets] =
    useState<string[]>(selectedDatasets);
  const [filters, setFilters] = useState<FilterState>(
    propFilters || defaultFilters,
  );
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [datasetsToAdd, setDatasetsToAdd] = useState<DatasetWithCollections[]>(
    [],
  );
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showTitleActionsDropdown, setShowTitleActionsDropdown] =
    useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [canDeleteCollection, setCanDeleteCollection] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isSmartSearchEnabledLocal, setIsSmartSearchEnabledLocal] =
    useState(false);
  const isSmartSearchEnabled =
    typeof controlledSmartSearchEnabled === "boolean"
      ? controlledSmartSearchEnabled
      : isSmartSearchEnabledLocal;

  // Handle mobile detection and sidebar state
  useEffect(() => {
    //Remove the last conversation id when not transitioning between conversations
    sessionStorage.removeItem("lastConversationId");
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      const tablet = window.innerWidth >= 640 && window.innerWidth < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close right-side panels when sidebar opens on tablets
  useEffect(() => {
    const handleSidebarOpenedForTablet = () => {
      if (isTablet) {
        if (showSelectedPanel) {
          handleClosePanel();
        }
      }
    };

    window.addEventListener(
      "sidebarOpenedForTablet",
      handleSidebarOpenedForTablet,
    );
    return () => {
      window.removeEventListener(
        "sidebarOpenedForTablet",
        handleSidebarOpenedForTablet,
      );
    };
  }, [isTablet, showSelectedPanel, handleClosePanel]);

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
      if (!api.hasToken) {
        throw new Error("No access token available");
      }

      await api.deleteCollection(collectionId);
      await refreshExtraCollections();
      window.dispatchEvent(new CustomEvent("forceCollectionsRefresh"));
      notifyCollectionModified();

      setShowDeleteModal(false);
      setToastType("success");
      setToastMessage("Collection deleted successfully!");
      setShowToast(true);

      setTimeout(() => {
        router.push(getNavigationUrl("/dashboard"));
      }, 500);
    } catch (error) {
      logApiError("deleteCollection", error, { collectionId });
      setToastType("error");
      setToastMessage("Failed to delete collection. Please try again.");
      setShowToast(true);
      setIsDeleting(false);
      setShowDeleteModal(false);
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
      if (onCollectionNameUpdate) {
        onCollectionNameUpdate(editingName.trim());
      }
      setIsEditingName(false);
    } catch (error) {
      logger.error(
        { error, collectionName: editingName.trim() },
        "Failed to update collection name",
      );
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

  // Load viewMode from localStorage only after component mounts
  useEffect(() => {
    if (isMounted) {
      const stored = localStorage.getItem("browseViewMode");
      if (stored && (stored === "grid" || stored === "list")) {
        setViewMode(stored);
      }
    }
  }, [isMounted]);

  // Check if user can delete collection
  // For custom collections (except Favorites), always show delete button
  // The API will handle permission check when deletion is attempted
  useEffect(() => {
    if (!isCustomCollection) {
      setCanDeleteCollection(false);
      return;
    }

    // Don't allow deleting Favorites collection
    if (
      collectionName === "Favorites" ||
      collectionName === "Favorites Datasets"
    ) {
      setCanDeleteCollection(false);
      return;
    }

    // For all other custom collections, show delete button
    // API will validate permissions when deletion is attempted
    setCanDeleteCollection(true);
  }, [isCustomCollection, collectionName]);

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
    if (!api.hasToken) return;

    // Fetch fields of science
    api
      .getFieldsOfScience()
      .then((data) => {
        const categories = processFieldsOfScience(data);
        setFieldsOfScienceCategories(categories);
      })
      .catch((error) => {
        logger.error({ error }, "Failed to fetch fields of science");
        setFieldsOfScienceCategories([]);
      });

    // Fetch licenses
    api
      .getLicenses()
      .then((data) => {
        const licenseOptions = processLicenses(data);
        setLicenses(licenseOptions);
      })
      .catch((error) => {
        logger.error({ error }, "Failed to fetch licenses");
        setLicenses([]);
      });
  }, [api.hasToken]);

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
          "[data-title-actions-dropdown]",
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
          "[data-actions-dropdown]",
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
    // On tablets, request sidebar to close to ensure only one panel is visible
    if (isTablet) {
      window.dispatchEvent(new CustomEvent("requestCloseSidebarForTablet"));
    }
  };

  function handleClosePanel() {
    setIsPanelClosing(true);
    setTimeout(() => {
      if (onCloseSidebar) {
        onCloseSidebar();
      }
      setIsPanelClosing(false);
    }, 500);
  }

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
                  (dataset as unknown as Record<string, unknown>).permissions,
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
  }, [datasets, filters.access]);

  const selectAll = () => {
    const allIds = filteredDatasets.map((d) => d.id);
    setCurrentSelectedDatasets(allIds);
  };

  const deselectAll = () => {
    setCurrentSelectedDatasets([]);
  };

  const _toggleSelectAll = () => {
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
  const _allFilteredSelected = useMemo(() => {
    const allIds = filteredDatasets.map((d) => d.id);
    return (
      allIds.length > 0 &&
      allIds.every((id) => currentSelectedDatasets.includes(id))
    );
  }, [filteredDatasets, currentSelectedDatasets]);

  const handleDatasetClick = (dataset: DatasetWithCollections) => {
    if (!isModal) {
      router.push(getNavigationUrl(`/datasets/${dataset.id}`));
    }
  };

  const handleDatasetSelect = (datasetId: string, isSelected: boolean) => {
    if (isSelected) {
      setCurrentSelectedDatasets([...currentSelectedDatasets, datasetId]);
      // Open the SelectedDatasetsPanel when a dataset is selected
      handleOpenPanel();
    } else {
      setCurrentSelectedDatasets(
        currentSelectedDatasets.filter((id) => id !== datasetId),
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
            (opt) => opt.value === fieldCode,
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
  }, [filters, fieldsOfScienceCategories, licenses]);

  const isPanelVisible = showSelectedPanel || isPanelClosing;
  const shouldShowSmartExamples =
    showSearchAndFilters !== false &&
    isSmartSearchEnabled &&
    (searchTerm ?? "").trim().length === 0;

  return (
    <div className="flex relative min-h-screen">
      <div
        className={`flex-1 transition-all duration-500 ease-out ${
          isPanelVisible ? "sm:pr-[388px]" : ""
        }`}
      >
        <div className="max-w-5xl mx-auto relative transition-all duration-500 ease-out py-4 sm:py-10">
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between mb-4 px-4 sm:px-6">
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
                  <h1 className="text-H2-32-semibold sm:text-H2-24-semibold text-gray-750">
                    {title}
                  </h1>
                  <p className="text-H2-20-regular text-gray-650">{subtitle}</p>
                </>
              )}
            </div>
            {/* Right side buttons - hide when editing */}
            {!isEditingName && (
              <div className="flex items-center gap-3">
                {/* Actions dropdown button - only show on custom collection pages, not on Favorites */}
                {isCustomCollection &&
                  collectionName !== "Favorites Datasets" && (
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
                              selectAll();
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
                              setShowTitleActionsDropdown(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-icon" />
                            Delete
                          </button>
                          {canDeleteCollection && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowTitleActionsDropdown(false);
                                setShowDeleteModal(true);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                              Delete Collection
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                {/* Custom Action Buttons */}
                {customActionButtons?.map((button, index) => (
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
                            selectAll();
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
          {/* Smart Search banner */}
          {showSearchAndFilters !== false && (
            <div className="px-4 sm:px-6">
              <SmartSearch
                enabled={isSmartSearchEnabled}
                onToggle={(val) => {
                  if (onSmartSearchToggle) {
                    onSmartSearchToggle(!!val);
                  } else {
                    setIsSmartSearchEnabledLocal(!!val);
                  }
                }}
              />
            </div>
          )}

          {/* Search and filters */}
          {showSearchAndFilters !== false && (
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 mb-4 px-4 sm:px-6">
              <div className="flex-1 w-full">
                <Search
                  placeholder="Search datasets..."
                  value={searchTerm}
                  onChange={onSearchTermChange}
                  onSearch={(value) => onSearchTermSubmit?.(value)}
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
              {!isMobile && (
                <Switch
                  leftIcon={ListChecks}
                  rightIcon={Grid2X2}
                  value={viewMode === "grid" ? "right" : "left"}
                  onChange={(value) =>
                    setViewMode(value === "right" ? "grid" : "list")
                  }
                />
              )}
            </div>
          )}
          {/* Smart search examples */}
          {shouldShowSmartExamples && (
            <SmartSearchExamples
              className="px-4 pt-6 sm:px-6 sm:pt-24 mb-4"
              onPickExample={(value) => {
                if (onSearchTermChange) onSearchTermChange(value);
                if (onSearchTermSubmit) onSearchTermSubmit(value);
              }}
            />
          )}
          {/* Active Filters */}
          {showSearchAndFilters !== false && activeFilterTags.length > 0 && (
            <div className="flex gap-2 mb-4 flex-nowrap sm:flex-wrap overflow-x-auto pl-4 sm:px-6">
              {activeFilterTags.map((tag) => (
                <Chip
                  key={tag.key}
                  className="flex-none"
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
          {showSearchAndFilters !== false && !shouldShowSmartExamples && (
            <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
              <p className="text-body-14-regular text-gray-650">
                Showing:{" "}
                <span className="text-body-14-medium text-gray-750">
                  {filteredDatasets.length}{" "}
                  {filteredDatasets.length === 1 ? "result" : "results"}
                </span>
              </p>
              <SortingDropdown
                value={sortBy}
                onChange={(value) => onSortByChange?.(value)}
                options={SORTING_OPTIONS}
                triggerLabel="Sorting"
              />
            </div>
          )}
          {/* Main content area - do not shift cards when modal is open */}
          {!shouldShowSmartExamples && (
            <div className="transition-all duration-300 px-4 sm:px-6">
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
                  {filteredDatasets.map((dataset, index) => (
                    <DatasetCard
                      key={dataset.id || `dataset-${index}`}
                      dataset={dataset}
                      onClick={() => handleDatasetClick(dataset)}
                      isMultiSelected={currentSelectedDatasets.includes(
                        dataset.id,
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
                      hasSidePanelOpen={showSelectedPanel && !isPanelClosing}
                      isSmartSearchEnabled={isSmartSearchEnabled}
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
        onCreateCollection={(_name: string) => {
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

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        type={toastType}
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
