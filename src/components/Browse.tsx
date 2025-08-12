"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  MessageSquare,
  Database,
  ListChecks,
  Grid2X2,
} from "lucide-react";
import { Dataset } from "@/data/mockDatasets";
type Collection = { id: string; name: string };
type DatasetWithCollections = Dataset & { collections?: Collection[] };
import DatasetCard from "./DatasetCard";
import DatasetDetailsPanel from "./DatasetDetailsPanel";
import SelectedDatasetsPanel from "./SelectedDatasetsPanel";
import FilterModal from "./FilterModal";
import {
  FilterState,
  getDefaultFilters,
  LICENSE_OPTIONS,
  fetchFieldsOfScience,
  SORTING_OPTIONS,
} from "../config/filterOptions";
import AddToCollectionModal from "./AddToCollectionModal";
import { Button } from "./ui/Button";
import Switch from "./ui/Switch";
import { Chip } from "./ui/Chip";
import SortingDropdown from "./SortingDropdown";
import { useRouter } from "next/navigation";
import { HierarchicalCategory } from "./ui/HierarchicalDropdown";
import { useSession } from "next-auth/react";
import { getNavigationUrl } from "@/lib/utils";

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
  onSearchTermSubmit?: () => void;
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
  onApplyFilters?: (filters: FilterState) => void;
  filters?: FilterState;
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
  showAddButton = true, // default true
  searchTerm = "",
  onSearchTermChange,
  onSearchTermSubmit,
  isLoading = false,
  error = null,
  sortBy = "name-asc",
  onSortByChange,
  onApplyFilters,
  filters: propFilters,
  showSearchAndFilters = true, // Default to true
}: BrowseProps) {
  const router = useRouter();
  const { data: session } = useSession() as any;
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
  const [showAddToCollectionModal, setShowAddToCollectionModal] =
    useState(false);
  const [datasetToAdd, setDatasetToAdd] =
    useState<DatasetWithCollections | null>(null);
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [isDetailsPanelAnimating, setIsDetailsPanelAnimating] = useState(false);
  const [isDetailsPanelClosing, setIsDetailsPanelClosing] = useState(false);

  // Use controlled or local state for selected datasets
  const currentSelectedDatasets = onSelectedDatasetsChange
    ? selectedDatasets
    : localSelectedDatasets;
  const setCurrentSelectedDatasets =
    onSelectedDatasetsChange || setLocalSelectedDatasets;

  // Set mounted to true after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Fetch fields of science on component mount
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
  }, [session]);

  // Animate SelectedDatasetsPanel on open
  useEffect(() => {
    if (showSelectedPanel) {
      setIsPanelAnimating(true);
      const t = setTimeout(() => setIsPanelAnimating(false), 50);
      return () => clearTimeout(t);
    }
  }, [showSelectedPanel]);

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
    setDatasetToAdd(dataset);
    setShowAddToCollectionModal(true);
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
        const licenseOption = LICENSE_OPTIONS.find(
          (opt) => opt.value === licenseCode
        );
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
  }, [filters, propFilters, fieldsOfScienceCategories]);

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
            <div>
              <h1 className="text-H2-32-semibold text-gray-750">{title}</h1>
              <p className="text-body-16-regular text-gray-650 mt-1">
                {subtitle}
              </p>
            </div>
            <div className="flex items-center gap-3">
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
            </div>
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
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-icon w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={searchTerm}
                  onChange={(e) =>
                    onSearchTermChange && onSearchTermChange(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onSearchTermSubmit)
                      onSearchTermSubmit();
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700 rounded px-4 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => onSearchTermSubmit && onSearchTermSubmit()}
                  tabIndex={0}
                  aria-label="Search"
                >
                  Search
                </button>
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
              <div className="flex justify-center items-center h-96">
                <svg
                  className="animate-spin h-8 w-8 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
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
                  />
                ))}
              </div>
            )}
            {/* Empty state */}
            {!isLoading && !error && filteredDatasets.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Search className="w-12 h-12 mx-auto text-icon" />
                </div>
                <h3 className="text-H6-18-semibold text-gray-900 mb-2">
                  No datasets found
                </h3>
                <p className="text-body-16-regular text-gray-600">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>

          {/* Dataset Details Panel */}
          {!isModal && (isDetailsPanelVisible || isDetailsPanelClosing) && (
            <div className="fixed right-0 bottom-0 top-14 z-40 w-full sm:w-[380px] will-change-transform pointer-events-none">
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

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        isVisible={showAddToCollectionModal}
        onClose={() => {
          setShowAddToCollectionModal(false);
          setDatasetToAdd(null);
        }}
        dataset={datasetToAdd}
      />
      {/* Selected Datasets Panel (right side, under header similar to Chat) */}
      {(showSelectedPanel || isPanelClosing) && (
        <div className="fixed right-0 bottom-0 top-14 z-40 w-full sm:w-[380px] will-change-transform pointer-events-none">
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
