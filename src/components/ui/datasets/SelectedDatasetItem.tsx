"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Share,
  Eye,
  HardDrive,
  FileCheck,
  CalendarPlus,
  RefreshCcw,
} from "lucide-react";
import type { DatasetUnion } from "@/types/datasets";
import { Chip } from "../Chip";
import { Button } from "../Button";
import { formatDate, formatFileSize, getMimeTypeName } from "@/lib/utils";
import MetadataItem from "./MetadataItem";

interface Collection {
  id?: string;
  name: string;
}

interface SelectedDatasetItemProps {
  dataset: DatasetUnion;
  isExpanded: boolean;
  onToggleExpanded: (datasetId: string) => void;
  onRemoveDataset: (id: string) => void;
  hideRemoveDataset?: boolean;
}

// Helper function to check if dataset has collections (matching DatasetCard logic)
function hasCollections(
  dataset: DatasetUnion
): dataset is DatasetUnion & { collections: Collection[] } {
  const maybeCollections = (dataset as { collections?: unknown }).collections;
  return (
    Array.isArray(maybeCollections) &&
    maybeCollections.every(
      (col: unknown) => col && typeof col === "object" && "name" in col
    )
  );
}

// Helper function to get dataset name from either mock or API dataset
function getDatasetName(dataset: DatasetUnion): string {
  if ("title" in dataset && dataset.title) return dataset.title;
  if ("name" in dataset && dataset.name) return dataset.name;
  return "Unknown Dataset";
}

export default function SelectedDatasetItem({
  dataset,
  isExpanded,
  onToggleExpanded,
  onRemoveDataset,
  hideRemoveDataset = false,
}: SelectedDatasetItemProps) {
  const displayName = getDatasetName(dataset);
  const displayDescription =
    "description" in dataset && dataset.description ? dataset.description : "";
  const displaySize = "size" in dataset && dataset.size ? dataset.size : "";
  const displayUpdated =
    "lastUpdated" in dataset && dataset.lastUpdated ? dataset.lastUpdated : "";
  const displayTags =
    "tags" in dataset && Array.isArray(dataset.tags) ? dataset.tags : [];

  // Get collections using the same logic as DatasetCard
  const hasDatasetCollections = hasCollections(dataset);

  // Calculate display category/collection name with proper processing
  const displayCategory = (() => {
    if (hasDatasetCollections && dataset.collections.length > 0) {
      // Use first collection name and remove " Collection" suffix like DatasetCard
      const firstCollection = dataset.collections[0];
      return typeof firstCollection.name === "string"
        ? firstCollection.name.replace(/ Collection$/i, "")
        : firstCollection.name;
    }
    // Fallback to category if no collections
    return "category" in dataset && dataset.category ? dataset.category : "";
  })();

  const permissions =
    "permissions" in dataset ? dataset.permissions : undefined;
  const displayAccess =
    "access" in dataset && dataset.access
      ? dataset.access
      : Array.isArray(permissions) && permissions.includes("browsedataset")
        ? "Open Access"
        : "Restricted";

  const sourceUrl =
    "url" in dataset && typeof dataset.url === "string"
      ? dataset.url
      : undefined;

  // Metadata items array
  const metadataItems = [
    {
      icon: <CalendarPlus className="w-5 h-5" />,
      label: "Added",
      value:
        formatDate(
          "datePublished" in dataset &&
            typeof dataset.datePublished === "string"
            ? dataset.datePublished
            : undefined
        ) || "-",
    },
    {
      icon: <RefreshCcw className="w-5 h-5" />,
      label: "Last updated",
      value: formatDate(displayUpdated) || "-",
    },
    {
      icon: <HardDrive className="w-5 h-5" />,
      label: "File Size",
      value: displaySize ? formatFileSize(displaySize) : "-",
    },
    {
      icon: <FileCheck className="w-5 h-5" />,
      label: "File Type",
      value: (
        getMimeTypeName(
          "mimeType" in dataset && typeof dataset.mimeType === "string"
            ? dataset.mimeType
            : undefined
        ) || "-"
      ).toUpperCase(),
    },
  ];

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      {/* Dataset Header */}
      <div className="p-4">
        <div className="flex items-center justify-between py-1 mb-2">
          <button
            onClick={() => onToggleExpanded(dataset.id)}
            className="flex items-center flex-1 text-left"
          >
            <h3 className="text-body-16-semibold text-gray-750 line-clamp-2">
              {displayName}
            </h3>
          </button>
          <button
            onClick={() => onToggleExpanded(dataset.id)}
            className="flex-shrink-0 p-1 rounded-md transition-colors ml-2 hover:bg-gray-200"
            title={isExpanded ? "Show less" : "Show more"}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-icon" />
            ) : (
              <ChevronDown className="w-5 h-5 text-icon" />
            )}
          </button>
        </div>

        {(displayCategory || displayAccess) && (
          <div className="flex items-center gap-1 mb-2">
            {displayCategory && (
              <Chip color="info" variant="outline" size="sm">
                {displayCategory}
              </Chip>
            )}
            {displayAccess && (
              <Chip
                color={displayAccess === "Open Access" ? "success" : "warning"}
                size="sm"
              >
                {displayAccess}
              </Chip>
            )}
          </div>
        )}

        {/* Description - 2 lines when collapsed, full when expanded */}
        {displayDescription && (
          <p
            className={`text-descriptions-12-regular text-gray-650 ${!isExpanded ? "line-clamp-2" : ""}`}
          >
            {displayDescription}
          </p>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 bg-white">
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 w-full justify-center"
                >
                  <Share className="w-4 h-4" />
                  Source
                </Button>
              </a>
            ) : (
              <div />
            )}
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex items-center gap-2 w-full justify-center"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 mb-8"></div>

          {/* Metadata grid - 2 rows, 2 columns */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {metadataItems.map((item, index) => (
              <MetadataItem
                key={index}
                icon={item.icon}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
