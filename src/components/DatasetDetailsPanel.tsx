"use client";

import {
  CalendarPlus,
  FileCheck,
  HardDrive,
  Info,
  LayoutList,
  MonitorCheck,
  PackagePlus,
  RefreshCcw,
  Share,
  X,
} from "lucide-react";
import type { Dataset } from "@/data/dataset";
import { formatDate, formatFileSize, getMimeTypeName } from "@/lib/utils";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import MetadataItem from "./ui/datasets/MetadataItem";
import FormattedText from "./ui/FormattedText";

interface DatasetDetailsPanelProps {
  dataset: Dataset | null;
  onClose: () => void;
  isVisible: boolean;
  onAddToCollection?: () => void;
}

interface Collection {
  id: string;
  name: string;
}
function hasCollections(
  dataset: Dataset | (Dataset & { collections?: unknown }),
): dataset is Dataset & { collections: Collection[] } {
  const maybeCollections = (dataset as { collections?: unknown }).collections;
  return (
    Array.isArray(maybeCollections) &&
    maybeCollections.every(
      (col: unknown) => col && typeof col === "object" && "name" in col,
    )
  );
}

export default function DatasetDetailsPanel({
  dataset,
  onClose,
  isVisible,
  onAddToCollection,
}: DatasetDetailsPanelProps) {
  const hasDatasetCollections = dataset && hasCollections(dataset);

  // Calculate display category/collection name with proper processing
  const displayCategory = (() => {
    if (dataset && hasDatasetCollections && dataset.collections.length > 0) {
      // Use first collection name and remove " Collection" suffix like DatasetCard
      const firstCollection = dataset.collections[0];
      return typeof firstCollection.name === "string"
        ? firstCollection.name.replace(/ Collection$/i, "")
        : firstCollection.name;
    }
    // Fallback to category if no collections
    return dataset && "category" in dataset && dataset.category
      ? dataset.category
      : "";
  })();
  const permissions =
    dataset && "permissions" in dataset ? dataset.permissions : undefined;
  const displayAccess =
    dataset && "access" in dataset && dataset.access
      ? dataset.access
      : Array.isArray(permissions) && permissions.includes("browsedataset")
        ? "Open Access"
        : "Restricted";
  const displayUpdated =
    dataset && "lastUpdated" in dataset && dataset.lastUpdated
      ? dataset.lastUpdated
      : "";
  const sourceUrl =
    dataset && "url" in dataset && typeof dataset.url === "string"
      ? dataset.url
      : undefined;
  const displaySize =
    dataset && "size" in dataset && dataset.size ? dataset.size : "";
  const displayKeywords = (() => {
    if (dataset && "keywords" in dataset && dataset.keywords) {
      // Handle both array and single string cases
      if (Array.isArray(dataset.keywords)) {
        return dataset.keywords.length > 0 ? dataset.keywords : undefined;
      } else if (typeof dataset.keywords === "string") {
        return [dataset.keywords];
      }
    }
    return undefined;
  })();
  const displayFieldsOfScience = (() => {
    if (dataset && "fieldOfScience" in dataset && dataset.fieldOfScience) {
      // Handle both array and single string cases
      if (Array.isArray(dataset.fieldOfScience)) {
        return dataset.fieldOfScience.length > 0
          ? dataset.fieldOfScience
          : undefined;
      } else if (typeof dataset.fieldOfScience === "string") {
        return [dataset.fieldOfScience];
      }
    }
    return undefined;
  })();

  const dateMetadataItems = [
    {
      icon: <CalendarPlus className="w-5 h-5" />,
      label: "Added",
      value:
        formatDate(
          dataset &&
            "datePublished" in dataset &&
            typeof dataset.datePublished === "string"
            ? dataset.datePublished
            : undefined,
        ) || "-",
    },
    {
      icon: <RefreshCcw className="w-5 h-5" />,
      label: "Last updated",
      value: formatDate(displayUpdated) || "-",
    },
  ];

  const dataPreviewMetadataItems = [
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
          dataset &&
            "mimeType" in dataset &&
            typeof dataset.mimeType === "string"
            ? dataset.mimeType
            : undefined,
        ) || "-"
      ).toUpperCase(),
    },
  ];

  if (!isVisible || !dataset) {
    return null;
  }

  return (
    <div className="h-full w-full bg-white border-l border-gray-200 shadow-lg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-5.25 flex items-center justify-between">
        <h2 className="text-H6-18-semibold text-slate-850">Dataset Details</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-75 rounded-sm transition-colors"
        >
          <X className="w-5 h-5 text-icon" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4">
        {/* Title and Tags */}
        <div className="px-4">
          <h3 className="text-H2-20-semibold text-slate-850 mb-4">
            {dataset.title}
          </h3>
          {(displayCategory || displayAccess) && (
            <div className="flex items-center gap-1">
              {displayCategory && (
                <Chip color="info" variant="outline" size="sm">
                  {displayCategory}
                </Chip>
              )}
              {displayAccess && (
                <Chip
                  color={
                    displayAccess === "Open Access" ? "success" : "warning"
                  }
                  size="sm"
                >
                  {displayAccess}
                </Chip>
              )}
            </div>
          )}
        </div>

        {/* Metadata grid - 2 rows, 2 columns */}
        <div className="grid grid-cols-2 gap-4 mb-6 pt-3 px-4">
          {dateMetadataItems.map((item, index) => (
            <MetadataItem
              key={index}
              icon={item.icon}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>

        <div className="flex flex-col gap-4 px-4">
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
          {onAddToCollection && (
            <Button
              size="sm"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={onAddToCollection}
            >
              <PackagePlus className="w-4 h-4 text-icon" />
              Add to collection
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200" />

        {/* Description */}
        <div className="space-y-4 px-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-icon" />
            <h4 className="text-body-14-medium text-slate-850">Description</h4>
          </div>

          <FormattedText
            as="p"
            className="text-body-14-regular text-gray-650 break-words"
            text={dataset.description}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200" />

        {/* Data Preview */}
        <div className="space-y-4 px-4">
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-4 h-4 text-icon" />
            <h4 className="text-body-14-medium text-slate-850">Data preview</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 py-3">
            {dataPreviewMetadataItems.map((item, index) => (
              <MetadataItem
                key={index}
                icon={item.icon}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200" />

        {/* Metadata */}
        <div className="space-y-4 px-4">
          <div className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-icon" />
            <h4 className="text-body-14-medium text-slate-850">Metadata</h4>
          </div>
        </div>

        {/* License */}
        <div className="flex items-center gap-2 justify-between pt-2 px-4">
          <h4 className="text-body-14-medium text-slate-850">License</h4>
          <p className="text-body-14-regular text-gray-650">
            {dataset.license || "-"}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 mx-4" />

        {/* Keywords */}
        <div className="flex items-center gap-4 justify-between px-4">
          <h4 className="text-body-14-medium text-slate-850 shrink-0">
            Keywords
          </h4>
          <p className="text-body-14-regular text-gray-750 text-right">
            {displayKeywords?.map((keyword, index) => {
              return (
                <span
                  key={keyword}
                  className="text-gray-750 border-b border-gray-750 mr-1"
                >
                  {keyword}
                  {index < displayKeywords.length - 1 && ", "}
                </span>
              );
            }) || "-"}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 mx-4" />

        {/* Field of Science */}
        <div className="flex items-center gap-4 justify-between px-4">
          <h4 className="text-body-14-medium text-slate-850 shrink-0">
            Field of Science
          </h4>
          <p className="text-body-14-regular text-gray-650 text-right">
            {displayFieldsOfScience?.map((field, index) => {
              const firstLetter = field.slice(0, 1).toUpperCase();
              const remaining = field.slice(1).toLowerCase();
              return (
                <span key={field}>
                  {firstLetter}
                  {remaining}
                  {index < displayFieldsOfScience.length - 1 && ", "}
                </span>
              );
            }) || "-"}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 mx-4" />
      </div>
    </div>
  );
}
