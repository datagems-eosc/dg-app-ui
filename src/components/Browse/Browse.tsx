"use client";

import { Search } from "@ui/Search";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Database,
  Edit3,
  Filter,
  Grid2X2,
  ListChecks,
  MoreHorizontal,
  Search as SearchIcon,
  Settings,
  Tag,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useState } from "react";

type Collection = { id: string; name: string };
type DatasetWithCollections = Dataset & { collections?: Collection[] };

import { Button } from "@ui/Button";
import { ConfirmationModal } from "@ui/ConfirmationModal";
import DatasetCardSkeleton from "@ui/datasets/DatasetCardSkeleton";
import SmartSearch from "@ui/SmartSearch";
import SmartSearchExamples from "@ui/SmartSearchExamples";
import Switch from "@ui/Switch";
import { Toast } from "@ui/Toast";
import { WorkingStatus } from "@ui/WorkingStatus";
import { useRouter } from "next/navigation";
import { APP_ROUTES } from "@/config/appUrls";
import {
  COLLECTION_ROLE_MAP,
  mapRolesToPermissions,
} from "@/config/contextGrantRoles";
import { UI_CONSTANTS } from "@/config/uiConstants";
import { TOAST_MESSAGES } from "@/constants/toastMessages.mjs";
import { useCollections } from "@/contexts/CollectionsContext";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import type { Dataset } from "@/data/dataset";
import { mockDatasets } from "@/data/dataset";
import { filterPackagesBySearchTerm, mockPackages } from "@/data/package";
import { useApi } from "@/hooks/useApi";
import { useDatasetVocabularies } from "@/hooks/useDatasetVocabularies";
import logger, { logApiError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import {
  type FilterState,
  getDefaultFilters,
  SORTING_OPTIONS,
} from "../../config/filterOptions";
import CreateCollectionModal from "../CreateCollectionModal";
import DatasetCard from "../DatasetCard";
import FilterModal from "../FilterModal";
import PackageCarousel from "../PackageCarousel";
import SelectedDatasetsPanel from "../SelectedDatasetsPanel";
import SortingDropdown from "../SortingDropdown";
import { CollectionPermissionsModal } from "../ui/user/CollectionPermissionsModal";
import ActiveFilters from "./ActiveFilters";
import { useDatasetSearchExamples } from "./useDatasetSearchExamples";

const SMART_SEARCH_STATUS = [
  "Searching inside the data",
  "Still searching",
] as const;

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
  onBulkRemoveDatasets?: (datasetIds: string[]) => Promise<void> | void;
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
   * The search the shown results belong to (the last submitted text).
   */
  appliedSearchTerm?: string;
  /**
   * Loader state for async dataset fetching (from parent).
   */
  isLoading?: boolean;
  /**
   * Error message for async dataset fetching (from parent).
   */
  error?: string | null;
  /**
   * Server total for the current list, when it is larger than what is shown.
   */
  totalCount?: number;
  /**
   * More datasets can be loaded (catalogue paging from parent).
   */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Shown beside "Load more"; the list already loaded stays. */
  loadMoreError?: string | null;
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
  selectedPackageIds?: string[];
  onPackageSelect?: (packageId: string) => void;
  onPackageDeselect?: (packageId: string) => void;
  onDeselectAll?: () => void;
}

const defaultFilters: FilterState = getDefaultFilters();

/**
 * Browse's datasets carry no supported publication state: the shared mapper
 * leaves it unknown rather than inferring it from the caller's own Browse
 * permission. Access filtering is therefore unavailable, and a stale Access
 * selection is neither applied nor shown as active.
 */
export const ACCESS_FILTER_UNAVAILABLE_MESSAGE =
  "Filtering by public or restricted access isn't available yet.";

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
  onBulkRemoveDatasets,
  customActionButtons,
  showAddButton = true, // default true for backward compatibility
  showSearchAndFilters = true, // Default to true
  searchTerm = "",
  onSearchTermChange,
  onSearchTermSubmit,
  appliedSearchTerm = "",
  isLoading = false,
  error = null,
  totalCount,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  loadMoreError = null,
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
  selectedPackageIds = [],
  onPackageSelect,
  onPackageDeselect,
  onDeselectAll,
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
  const {
    fieldsOfScienceCategories,
    licenses,
    isLoading: isLoadingVocabularies,
  } = useDatasetVocabularies();
  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const actionsPanelId = useId();
  const [showTitleActionsDropdown, setShowTitleActionsDropdown] =
    useState(false);
  const titleActionsPanelId = useId();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCollectionPermissions, setShowCollectionPermissions] =
    useState(false);
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
  const [isPackageCarouselCollapsed, setIsPackageCarouselCollapsed] =
    useState(false);
  const datasetPackagingEnabled = useFeatureFlag("datasetPackage");
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

  const handleDeleteCollection = async () => {
    if (!isCustomCollection || !collectionName || !collectionId) {
      logger.warn(
        {
          isCustomCollection,
          hasCollectionName: !!collectionName,
          hasCollectionId: !!collectionId,
        },
        "Attempted to delete collection without required parameters",
      );
      return;
    }

    setIsDeleting(true);
    try {
      if (!api.hasToken) {
        logApiError(
          "deleteCollection",
          new Error("No access token available"),
          {
            collectionId,
          },
        );
        throw new Error("No access token available");
      }

      await api.deleteCollection(collectionId);
      await refreshExtraCollections();
      window.dispatchEvent(new CustomEvent("forceCollectionsRefresh"));
      notifyCollectionModified();

      logger.info(
        {
          collectionId,
          collectionName,
          timestamp: new Date().toISOString(),
          operation: "deleteCollection",
          status: "success",
        },
        "Collection deleted successfully",
      );

      setShowDeleteModal(false);
      setToastType(TOAST_MESSAGES.collectionDeleted.type);
      setToastMessage(TOAST_MESSAGES.collectionDeleted.message);
      setShowToast(true);

      setTimeout(() => {
        router.push(getNavigationUrl(APP_ROUTES.BROWSE));
      }, UI_CONSTANTS.NAVIGATION_DELAY_MS);
    } catch (error) {
      const errorDetails = {
        collectionId,
        collectionName,
        timestamp: new Date().toISOString(),
        operation: "deleteCollection",
        status: "failed",
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        hasToken: !!api.hasToken,
      };

      if (error && typeof error === "object") {
        const errorObj = error as Record<string, unknown>;
        if ("response" in errorObj) {
          const response = errorObj.response as Record<string, unknown>;
          Object.assign(errorDetails, {
            responseStatus: response.status,
            responseStatusText: response.statusText,
            responseData: response.data,
            responseHeaders: response.headers,
          });
        }
        if ("code" in errorObj) {
          Object.assign(errorDetails, { errorCode: errorObj.code });
        }
        if ("config" in errorObj) {
          const config = errorObj.config as Record<string, unknown>;
          Object.assign(errorDetails, {
            requestUrl: config.url,
            requestMethod: config.method,
          });
        }
      }

      logger.error(errorDetails, "Failed to delete collection");
      logApiError("deleteCollection", error, { collectionId });

      setToastType(TOAST_MESSAGES.collectionDeleteFailed.type);
      setToastMessage(TOAST_MESSAGES.collectionDeleteFailed.message);
      setShowToast(true);
      setShowDeleteModal(false);
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
  // For custom collections (except Favorites), use context grants.
  // `useApi()` is a new object every render; depend on its stable members.
  const { getCollectionGrants, hasToken } = api;
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

    if (!collectionId || !hasToken) {
      setCanDeleteCollection(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const roles = await getCollectionGrants(collectionId);
      if (cancelled) return;
      const permissions = mapRolesToPermissions(roles, COLLECTION_ROLE_MAP);
      setCanDeleteCollection(Boolean(permissions.delete));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getCollectionGrants,
    hasToken,
    collectionId,
    collectionName,
    isCustomCollection,
  ]);

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

  // All other filtering is done on the backend. The frontend Access filter is
  // not applied: see ACCESS_FILTER_UNAVAILABLE_MESSAGE.
  const filteredDatasets = datasets;
  const hasStaleAccessFilter = Boolean(filters.access);
  const displayedFilters = useMemo(
    () => (filters.access ? { ...filters, access: "" } : filters),
    [filters],
  );

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

  const isPanelVisible = showSelectedPanel || isPanelClosing;
  const datasetSearchExamples = useDatasetSearchExamples();
  const shouldShowSmartExamples =
    showSearchAndFilters !== false &&
    isSmartSearchEnabled &&
    (searchTerm ?? "").trim().length === 0;

  const datasetsWithMockFallback = useMemo(() => {
    const byId = new Map(
      datasets.map((d) => [d.id, d as DatasetWithCollections]),
    );
    for (const m of mockDatasets) {
      if (!byId.has(m.id)) {
        byId.set(m.id, m as DatasetWithCollections);
      }
    }
    return Array.from(byId.values());
  }, [datasets]);

  const filteredPackages = useMemo(() => {
    const term = (searchTerm ?? "").trim();
    if (term.length === 0) return [];
    const nameById = new Map<string, string>(
      datasetsWithMockFallback.map((d) => {
        const name =
          "title" in d && d.title
            ? String(d.title)
            : "name" in d && d.name
              ? String(d.name)
              : d.id;
        return [d.id, name];
      }),
    );
    return filterPackagesBySearchTerm(
      mockPackages,
      term,
      (id): string => nameById.get(id) ?? id,
    );
  }, [searchTerm, datasetsWithMockFallback]);

  const shouldShowPackageCarousel =
    datasetPackagingEnabled &&
    showSearchAndFilters !== false &&
    (searchTerm ?? "").trim().length > 0;

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
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 w-full max-w-[900px] sm:min-h-[45px]">
                  <div className="flex-1 w-full sm:max-w-[680px]">
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
                      className="w-full h-[45px] px-3 text-H2-32-semibold text-gray-750 bg-slate-100 border border-transparent rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      placeholder="Enter collection name"
                    />
                    <p className="text-H2-20-regular text-icon mt-1">
                      {subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 h-[45px] sm:self-start">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={handleCancelEditName}
                      className="rounded-[40px] box-border w-[78px] whitespace-nowrap"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSaveName}
                      disabled={
                        !editingName.trim() ||
                        editingName.trim() ===
                          collectionName.replace(/\s+Datasets?$/, "")
                      }
                      className="rounded-[40px] box-border w-[126px] whitespace-nowrap"
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
                        aria-label="Collection actions"
                        aria-expanded={showTitleActionsDropdown}
                        aria-controls={
                          showTitleActionsDropdown
                            ? titleActionsPanelId
                            : undefined
                        }
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
                          id={titleActionsPanelId}
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
                              if (collectionId) {
                                setShowCollectionPermissions(true);
                              }
                            }}
                            className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors ${
                              collectionId
                                ? "text-gray-700 hover:bg-gray-50"
                                : "text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            <Settings className="w-4 h-4 text-icon" />
                            Manage permissions
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
                      aria-label="Selected dataset actions"
                      aria-expanded={showActionsDropdown}
                      aria-controls={
                        showActionsDropdown ? actionsPanelId : undefined
                      }
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
                        id={actionsPanelId}
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
                        {onBulkRemoveDatasets && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowActionsDropdown(false);
                              if (currentSelectedDatasets.length === 0) return;
                              await onBulkRemoveDatasets([
                                ...currentSelectedDatasets,
                              ]);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-icon" />
                            Delete
                          </button>
                        )}
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
                  smart={isSmartSearchEnabled}
                  placeholder={
                    isSmartSearchEnabled
                      ? "Describe what you need, e.g. “rainfall data in Central Europe”…"
                      : "Search by name or keyword…"
                  }
                  value={searchTerm}
                  onChange={(value) => {
                    onSearchTermChange?.(value);
                    // Emptying the box ends the search, like the clear button
                    // (the box does not submit under 3 characters).
                    if (value.trim() === "") onSearchTermSubmit?.("");
                  }}
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
              {/* Smart search results are ranked by relevance: no filters. */}
              {!isSmartSearchEnabled && (
                <Button
                  variant="outline"
                  className="flex items-center gap-1.5"
                  onClick={() => setShowFilterModal(true)}
                >
                  <Filter className="w-4 h-4 text-icon" />
                  Filter
                </Button>
              )}
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
          {shouldShowPackageCarousel && (
            <div
              className="overflow-hidden px-4 sm:px-6 mb-4 animate-in"
              role="region"
              aria-label="Dataset packages suggestions"
            >
              <button
                type="button"
                onClick={() =>
                  setIsPackageCarouselCollapsed(!isPackageCarouselCollapsed)
                }
                className="flex w-full items-center justify-between text-left mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                aria-expanded={!isPackageCarouselCollapsed}
              >
                <h3 className="text-body-16-semibold text-gray-750">
                  Dataset Packages
                </h3>
                {isPackageCarouselCollapsed ? (
                  <ChevronDown
                    className="w-5 h-5 text-icon shrink-0"
                    aria-hidden
                  />
                ) : (
                  <ChevronUp
                    className="w-5 h-5 text-icon shrink-0"
                    aria-hidden
                  />
                )}
              </button>
              {!isPackageCarouselCollapsed && (
                <PackageCarousel
                  packages={filteredPackages}
                  datasets={datasetsWithMockFallback}
                  selectedPackageIds={selectedPackageIds}
                  onSelectPackage={onPackageSelect ?? (() => {})}
                  onDeselectPackage={onPackageDeselect ?? (() => {})}
                />
              )}
            </div>
          )}
          {/* Smart search examples: the list stays, examples sit above it */}
          {shouldShowSmartExamples && datasetSearchExamples.length > 0 && (
            <div className="px-4 sm:px-6 mb-4">
              <p className="text-body-14-regular text-gray-650 mb-2">
                Try an example:
              </p>
              <SmartSearchExamples
                showHeader={false}
                align="start"
                examples={datasetSearchExamples}
                onPickExample={(value) => {
                  if (onSearchTermChange) onSearchTermChange(value);
                  if (onSearchTermSubmit) onSearchTermSubmit(value);
                }}
              />
            </div>
          )}
          {/* Active Filters */}
          {!isSmartSearchEnabled && (
            <ActiveFilters
              filters={displayedFilters}
              fieldsOfScienceCategories={fieldsOfScienceCategories}
              licenses={licenses}
              onRemoveFilter={removeFilter}
              showSearchAndFilters={showSearchAndFilters}
            />
          )}
          {showSearchAndFilters !== false && hasStaleAccessFilter && (
            <p
              role="status"
              className="mb-4 px-4 text-body-14-regular text-gray-650 sm:px-6"
            >
              {ACCESS_FILTER_UNAVAILABLE_MESSAGE}
            </p>
          )}
          {/* Results count and sorting */}
          {showSearchAndFilters !== false && (
            <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
              <p
                aria-live="polite"
                className="text-body-14-regular text-gray-650"
              >
                {isLoading ? (
                  appliedSearchTerm ? (
                    "Searching…"
                  ) : (
                    "Loading datasets…"
                  )
                ) : (
                  <>
                    Showing:{" "}
                    <span className="text-body-14-medium text-gray-750">
                      {filteredDatasets.length}
                      {totalCount && totalCount > filteredDatasets.length
                        ? ` of ${totalCount}`
                        : ""}{" "}
                      {(totalCount ?? filteredDatasets.length) === 1
                        ? "result"
                        : "results"}
                    </span>
                  </>
                )}
              </p>
              {isSmartSearchEnabled ? (
                <span className="text-body-14-regular text-gray-650">
                  {shouldShowSmartExamples
                    ? "Describe what you need to rank by relevance"
                    : "Sorted by relevance"}
                </span>
              ) : (
                <SortingDropdown
                  value={sortBy}
                  onChange={(value) => onSortByChange?.(value)}
                  options={SORTING_OPTIONS}
                  triggerLabel="Sorting"
                />
              )}
            </div>
          )}
          {/* Main content area - do not shift cards when modal is open */}
          <div className="transition-all duration-300 px-4 sm:px-6">
            {/* Loader or error */}
            {isLoading ? (
              <>
                {isSmartSearchEnabled && appliedSearchTerm && (
                  <div className="flex flex-col items-center gap-1 pt-4 pb-8 text-center">
                    <WorkingStatus
                      messages={SMART_SEARCH_STATUS}
                      repeat={false}
                      announcement={`Searching for “${appliedSearchTerm}”`}
                      iconSize={20}
                    />
                    <p className="max-w-xl line-clamp-2 break-words text-body-14-regular text-gray-650">
                      for “{appliedSearchTerm}”
                    </p>
                  </div>
                )}
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
              </>
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
                    showSelectButton
                    isEditMode={isEditMode}
                    onRemove={
                      isEditMode && onRemoveDataset
                        ? () => onRemoveDataset(dataset.id)
                        : undefined
                    }
                    viewMode={viewMode}
                    onAddToCollection={() => handleAddToCollection(dataset)}
                    showAddButton={showAddButton}
                    hasSidePanelOpen={showSelectedPanel && !isPanelClosing}
                    isSmartSearchEnabled={isSmartSearchEnabled}
                  />
                ))}
              </div>
            )}
            {!isLoading && !error && hasMore && onLoadMore && (
              <div className="flex flex-col items-center gap-2 py-6">
                {loadMoreError && (
                  <p role="alert" className="text-body-14-regular text-red-600">
                    {loadMoreError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="text-body-14-regular text-slate-500 hover:text-slate-700 hover:underline disabled:no-underline disabled:opacity-60 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850"
                >
                  {isLoadingMore ? "Loading…" : "Load more datasets"}
                </button>
              </div>
            )}
            {/* Empty state */}
            {!isLoading && !error && filteredDatasets.length === 0 && (
              <div className="text-center py-18 space-y-2">
                <SearchIcon className="w-10 h-10 mx-auto text-slate-350" />
                {appliedSearchTerm && isSmartSearchEnabled ? (
                  <>
                    <h3 className="text-body-16-semibold text-slate-850">
                      No datasets found for “{appliedSearchTerm}”.
                    </h3>
                    <p className="text-body-14-regular text-gray-650">
                      Try describing what you need in other words.
                    </p>
                  </>
                ) : appliedSearchTerm ? (
                  <>
                    <h3 className="text-body-16-semibold text-slate-850">
                      No dataset names or descriptions contain “
                      {appliedSearchTerm}”.
                    </h3>
                    <p className="text-body-14-regular text-gray-650">
                      Try fewer or different words
                      {onSmartSearchToggle
                        ? ", or let Smart search look inside the data."
                        : "."}
                    </p>
                    {onSmartSearchToggle && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        className="mx-auto"
                        onClick={() => onSmartSearchToggle(true)}
                      >
                        Turn on Smart search
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-body-16-semibold text-slate-850">
                      No datasets found matching your search criteria.
                    </h3>
                    <p className="text-body-14-regular text-gray-650">
                      Try rephrasing your question or using different keywords.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isVisible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
        fieldsOfScienceCategories={fieldsOfScienceCategories}
        licenses={licenses}
        isLoadingVocabularies={isLoadingVocabularies}
        accessUnavailableReason={ACCESS_FILTER_UNAVAILABLE_MESSAGE}
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

      <ConfirmationModal
        isVisible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCollection}
        title="Delete Collection"
        message1="This operation will permanently delete the collection. Are you sure?"
        message2=""
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        icon={<Trash2 className="w-8 h-8 text-red-500" />}
        isLoading={isDeleting}
      />
      <CollectionPermissionsModal
        isOpen={showCollectionPermissions}
        collectionId={collectionId}
        collectionName={collectionName || title}
        onClose={() => setShowCollectionPermissions(false)}
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
              datasets={datasetsWithMockFallback}
              selectedPackageIds={selectedPackageIds}
              packages={mockPackages}
              onRemoveDataset={(id: string) => handleDatasetSelect(id, false)}
              onChatWithData={onChatWithData}
              onClose={handleClosePanel}
              onAddToCollection={onAddToCollection}
              onDeselectAll={
                onDeselectAll ?? (() => setCurrentSelectedDatasets([]))
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
