"use client";

import React from "react";
import {
  Star,
  X,
  PackagePlus,
  FileCheck,
  HardDrive,
  CalendarCheck2,
} from "lucide-react";
import { Dataset } from "@/data/mockDatasets";
import { useDataset } from "@/contexts/DatasetContext";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { formatFileSize } from "@/lib/utils";

interface Collection {
  id?: string;
  name: string;
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
}: DatasetCardProps) {
  const { toggleFavorite, isFavorite } = useDataset();
  const isStarred = isFavorite(dataset.id);
  const isListMode = viewMode === "list";

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when starring
    toggleFavorite(dataset.id);
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

  return (
    <div
      className={`rounded-2xl border-1 hover:shadow-md transition-all cursor-pointer relative p-5 ${
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
            <div className="flex items-center gap-1">
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
            </div>
          </div>
          {!isEditMode && (
            <button
              onClick={handleStarClick}
              className="flex-shrink-0 p-1.5 hover:bg-slate-75 rounded"
            >
              <Star
                className={`w-5 h-5 ${
                  isStarred ? "fill-amber-200 text-amber-400" : "text-icon"
                }`}
              />
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-body-14-regular text-gray-650 mb-4 line-clamp-2">
          {dataset.description}
        </p>

        {/* Footer with action buttons and metadata */}
        <div className="flex items-center justify-between gap-2">
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
          <div className="flex items-center justify-between text-descriptions-12-regular text-gray-500">
            <div className="flex items-center gap-4">
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
