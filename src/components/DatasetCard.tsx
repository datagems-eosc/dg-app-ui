"use client";

import React, { useState, useEffect } from "react";
import {
  Star,
  X,
  PackagePlus,
  FileCheck,
  HardDrive,
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { Dataset } from "@/data/mockDatasets";
import { useDataset } from "@/contexts/DatasetContext";
import { Button } from "./ui/Button";
import FormattedText from "./ui/FormattedText";
import { Chip } from "./ui/Chip";
import { SmartSearchMatchItem } from "./ui/SmartSearchMatchItem";
import { formatFileSize } from "@/lib/utils";

interface Collection {
  id?: string;
  name: string;
}

interface SmartSearchMatch {
  number: number;
  description: string;
  matchPercentage: number;
}

function hasCollections(
  dataset: Dataset | (Dataset & { collections?: unknown })
): dataset is Dataset & { collections: Collection[] } {
  const maybeCollections = (dataset as { collections?: unknown }).collections;
  return (
    Array.isArray(maybeCollections) &&
    maybeCollections.every(
      (col: unknown) => col && typeof col === "object" && "name" in col
    )
  );
}

// Helper to get dataset name from either mock or API dataset
function getDatasetName(dataset: unknown): string {
  if (typeof dataset === "object" && dataset !== null) {
    const obj = dataset as Record<string, unknown>;
    if (typeof obj.title === "string" && obj.title) return obj.title;
    if (typeof obj.name === "string" && obj.name) return obj.name;
  }
  return "Unknown Dataset";
}

function getMimeTypeName(mimeType?: string): string {
  if (!mimeType) return "-";
  const parts = mimeType.split("/");
  return parts.length > 1 ? parts[1] : parts[0];
}

// Helper to format datePublished
function formatDatePublished(datePublished?: string): string {
  if (!datePublished) return "N/A";
  try {
    const date = new Date(datePublished);
    if (isNaN(date.getTime())) return "N/A";
    return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
  } catch {
    return "N/A";
  }
}

interface DatasetCardProps {
  dataset: Dataset;
  onClick?: () => void;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  onSelect?: (isSelected: boolean) => void;
  showSelectButton?: boolean;
  isEditMode?: boolean;
  onRemove?: () => void;
  viewMode?: "grid" | "list";
  onAddToCollection?: (dataset: Dataset) => void;
  showAddButton?: boolean; // NEW PROP
  isFavorite?: boolean; // NEW PROP to override hook behavior
  favoritesCollectionId?: string; // NEW PROP for API calls
  onAddToFavorites?: (datasetId: string) => Promise<void>; // NEW PROP
  hasFetchedFavorites?: boolean; // NEW PROP
  onRemoveFromFavorites?: (datasetId: string) => Promise<void>; // NEW PROP
  hasSidePanelOpen?: boolean; // NEW PROP to indicate if side panels are open
  isSmartSearchEnabled?: boolean; // NEW PROP for smart search functionality
  defaultExpanded?: boolean; // TEMP: opens card by default in smart test mode
}

export default function DatasetCard({
  dataset,
  onClick,
  isSelected = false,
  isMultiSelected = false,
  onSelect,
  showSelectButton = false,
  isEditMode = false,
  onRemove,
  viewMode = "grid",
  onAddToCollection,
  showAddButton = true, // default true for backward compatibility
  isFavorite: propIsFavorite, // NEW PROP to override hook behavior
  favoritesCollectionId = "", // NEW PROP for API calls
  onAddToFavorites, // NEW PROP
  hasFetchedFavorites = false, // NEW PROP
  onRemoveFromFavorites, // NEW PROP
  hasSidePanelOpen = false, // NEW PROP to indicate if side panels are open
  isSmartSearchEnabled = false, // NEW PROP for smart search functionality
  defaultExpanded = false,
}: DatasetCardProps) {
  const { toggleFavorite, isFavorite } = useDataset();
  const hookIsFavorite = isFavorite(dataset.id);
  const isStarred =
    propIsFavorite !== undefined ? propIsFavorite : hookIsFavorite;
  const isListMode = viewMode === "list";
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [shouldStackFooter, setShouldStackFooter] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Mock data for smart search matches - TODO: Replace with real backend data
  const smartSearchMatches: SmartSearchMatch[] = [
    {
      number: 1,
      description:
        "The fundamental theorem of calculus states that differentiation and integration are inverse operations... It can also be interpreted as a precise statement of the fact that differentiation is the inverse of integration.",
      matchPercentage: 95,
    },
    {
      number: 2,
      description: "Includes precipitation measurements and humidity levels",
      matchPercentage: 87,
    },
    {
      number: 3,
      description: "Geographic data covering multiple regions and time periods",
      matchPercentage: 78,
    },
  ];

  // Check if we should stack the footer (side panel open + small screen)
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmallScreen = window.innerWidth <= 1440;
      setShouldStackFooter(!isListMode && hasSidePanelOpen && isSmallScreen);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, [hasSidePanelOpen, isListMode]);

  const handleStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when starring

    console.log("Star clicked!", {
      datasetId: dataset.id,
      propIsFavorite,
      favoritesCollectionId,
      onAddToFavorites: !!onAddToFavorites,
      onRemoveFromFavorites: !!onRemoveFromFavorites,
      hasFetchedFavorites,
      isStarred,
      condition1: propIsFavorite !== undefined,
      condition2: !!favoritesCollectionId,
      condition3: !!onAddToFavorites && !!onRemoveFromFavorites,
      condition4: hasFetchedFavorites,
      allConditions:
        propIsFavorite !== undefined &&
        favoritesCollectionId &&
        onAddToFavorites &&
        onRemoveFromFavorites &&
        hasFetchedFavorites,
    });

    // If using prop-based favorite state and we have a favorites collection ID and have fetched favorites
    if (
      propIsFavorite !== undefined &&
      favoritesCollectionId &&
      onAddToFavorites &&
      onRemoveFromFavorites &&
      hasFetchedFavorites
    ) {
      console.log("Using API-based favorites");
      try {
        setIsFavoriteLoading(true);
        if (!isStarred) {
          // Add to favorites via API
          console.log("Adding to favorites via API...");
          await onAddToFavorites(dataset.id);
          console.log("Successfully added to favorites");
        } else {
          // Remove from favorites via API
          console.log("Removing from favorites via API...");
          await onRemoveFromFavorites(dataset.id);
          console.log("Successfully removed from favorites");
        }
      } catch (error) {
        console.error("Failed to modify favorites:", error);
      } finally {
        setIsFavoriteLoading(false);
      }
    } else {
      console.log("Using local hook behavior");
      // Fall back to local hook behavior
      toggleFavorite(dataset.id);
    }
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when selecting
    if (onSelect) {
      onSelect(!isMultiSelected);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when removing
    if (onRemove) {
      onRemove();
    }
  };

  const handleAddToCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when adding to collection
    if (onAddToCollection) {
      onAddToCollection(dataset);
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when expanding
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`rounded-2xl border-1 hover:shadow-md transition-all cursor-pointer relative p-5 h-fit ${
        isSmartSearchEnabled && !isListMode && hasSidePanelOpen
          ? "min-h-[280px]"
          : ""
      } ${
        isSelected
          ? "border-blue-650 shadow-s2 bg-blue-75"
          : isMultiSelected
            ? "border-blue-650 shadow-s2 bg-blue-75"
            : "border-slate-200 bg-white"
      }`}
      onClick={onClick}
    >
      {/* Edit mode remove button */}
      {isEditMode && onRemove && (
        <button
          onClick={handleRemoveClick}
          className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full text-red-600 hover:text-red-700 transition-colors z-10"
          title="Remove from collection"
        >
          <X className="w-4 h-4 text-icon" />
        </button>
      )}
      <>
        {/* Header with title and star */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-H6-18-semibold text-slate-850 mb-3 line-clamp-1">
              {getDatasetName(dataset)}
            </h2>
            <div className="flex items-center gap-1 flex-wrap">
              {hasCollections(dataset) && dataset.collections.length > 0 ? (
                dataset.collections.map((col) => (
                  <Chip
                    key={col.id || col.name}
                    color="info"
                    variant="outline"
                    size="sm"
                  >
                    {typeof col.name === "string"
                      ? col.name.replace(/ Collection$/i, "")
                      : col.name}
                  </Chip>
                ))
              ) : (
                <Chip color="info" variant="outline" size="sm">
                  {dataset.category}
                </Chip>
              )}
              <Chip
                color={dataset.access === "Open Access" ? "success" : "warning"}
                size="sm"
              >
                {dataset.access}
              </Chip>
              {/* Smart search match chip - only show in chips row for grid layout */}
              {isSmartSearchEnabled && !isListMode && (
                <Chip
                  color="smart-search"
                  variant="outline"
                  size="sm"
                  className="h-6 text-descriptions-12-medium tracking-1p flex-shrink-0"
                >
                  <Check className="w-3 h-3 mr-1" />
                  100% Match
                </Chip>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Smart search match chip - show on right side for list layout */}
            {isSmartSearchEnabled && isListMode && (
              <Chip
                color="smart-search"
                variant="outline"
                size="sm"
                className="h-6 text-descriptions-12-medium tracking-1p"
              >
                <Check className="w-3 h-3 mr-1" />
                100% Match
              </Chip>
            )}
            {!isEditMode && (
              <button
                onClick={handleStarClick}
                disabled={isFavoriteLoading}
                className={`flex-shrink-0 p-1.5 rounded transition-colors ${
                  isFavoriteLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-slate-75"
                }`}
              >
                {isFavoriteLoading ? (
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                ) : (
                  <Star
                    className={`w-5 h-5 ${
                      isStarred ? "fill-amber-200 text-amber-400" : "text-icon"
                    }`}
                  />
                )}
              </button>
            )}
            {/* Expand arrow for smart search */}
            {isSmartSearchEnabled && (
              <button
                onClick={handleExpandClick}
                className="flex-shrink-0 p-1.5 rounded transition-colors hover:bg-slate-75 cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-icon" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-icon" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <FormattedText
          as="p"
          className="text-body-14-regular text-gray-650 mb-4 line-clamp-2 break-words"
          text={dataset.description}
        />

        {/* Smart search expanded content */}
        {isSmartSearchEnabled && isExpanded && (
          <div className="mb-4">
            {smartSearchMatches.map((match, index) => (
              <SmartSearchMatchItem
                key={match.number}
                number={match.number}
                description={match.description}
                matchPercentage={match.matchPercentage}
                isLast={index === smartSearchMatches.length - 1}
              />
            ))}
          </div>
        )}

        {/* Footer with action buttons and metadata */}
        <div
          className={
            shouldStackFooter
              ? "flex flex-col gap-2"
              : "flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2"
          }
        >
          {/* Action buttons */}
          {!isEditMode && (
            <div className="flex items-center gap-2">
              {showSelectButton && onSelect && (
                <Button variant="outline" size="sm" onClick={handleSelectClick}>
                  {isMultiSelected ? "Deselect" : "Select"}
                </Button>
              )}
              {showAddButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddToCollectionClick}
                >
                  <PackagePlus className="w-4 h-4 mr-1 text-icon" />
                  Add
                </Button>
              )}
            </div>
          )}

          {/* Metadata */}
          <div
            className={
              shouldStackFooter
                ? "flex items-center text-descriptions-12-regular text-gray-500 mt-2 justify-end"
                : "flex items-center justify-between text-descriptions-12-regular text-gray-500"
            }
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-3 h-3 text-icon" />
                <span className="text-descriptions-12-regular text-gray-650 tracking-1p uppercase">
                  {getMimeTypeName(dataset.mimeType)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-3 h-3 text-icon" />
                <span className="text-descriptions-12-regular text-gray-650 tracking-1p">
                  {formatFileSize(dataset.size)}
                </span>
              </div>
              {isListMode && (
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="w-3 h-3 text-icon" />
                  <span className="text-descriptions-12-regular text-gray-650 tracking-1p">
                    {formatDatePublished(dataset.datePublished)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    </div>
  );
}
