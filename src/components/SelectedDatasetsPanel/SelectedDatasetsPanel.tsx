"use client";

import { Button } from "@ui/Button";
import MissingDatasetItem from "@ui/datasets/MissingDatasetItem";
import SelectedDatasetItem from "@ui/datasets/SelectedDatasetItem";
import { NoData } from "@ui/NoData";
import { ArrowUp, Bot, Database, PackagePlus, X } from "lucide-react";
import React from "react";
import type { DatasetUnion } from "@/types/datasets";

interface SelectedDatasetsPanelProps {
  selectedDatasetIds: string[];
  datasets: DatasetUnion[];
  onRemoveDataset: (id: string) => void;
  onAddToCollection?: () => void;
  onChatWithData?: () => void;
  onClose?: () => void;
  selectedDatasetNamesMap?: Record<string, string>;
  hideAddToCollection?: boolean;
  hideRemoveDataset?: boolean;
  customHeaderTitle?: string;
  onDeselectAll?: () => void;
}

export default function SelectedDatasetsPanel({
  selectedDatasetIds,
  datasets,
  onRemoveDataset,
  onAddToCollection,
  onChatWithData,
  onClose,
  selectedDatasetNamesMap = {},
  hideAddToCollection = false,
  hideRemoveDataset = false,
  customHeaderTitle,
  onDeselectAll,
}: SelectedDatasetsPanelProps) {
  const [expandedDatasets, setExpandedDatasets] = React.useState<string[]>([]);

  const selectedDatasets = datasets.filter((dataset) =>
    selectedDatasetIds.includes(dataset.id),
  );
  // Add fallback for missing datasets
  const missingDatasetIds = selectedDatasetIds.filter(
    (id) => !selectedDatasets.some((ds) => ds.id === id),
  );

  const toggleExpanded = (datasetId: string) => {
    setExpandedDatasets((prev) =>
      prev.includes(datasetId)
        ? prev.filter((id) => id !== datasetId)
        : [...prev, datasetId],
    );
  };

  return (
    <div className="h-full w-full bg-white border-l border-gray-200 shadow-lg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-5.25">
        <div className="flex items-center justify-between">
          <h2 className="text-H6-18-semibold text-slate-850">
            {customHeaderTitle ||
              `Selected Datasets (${selectedDatasetIds.length})`}
          </h2>
          <div className="flex items-center gap-2">
            {/* Close Panel button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-75 rounded-sm transition-colors"
                title="Close panel"
              >
                <X className="w-5 h-5 text-icon" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selected Datasets List (scrollable area) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {onAddToCollection &&
          !hideAddToCollection &&
          selectedDatasetIds.length > 0 && (
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 mb-4"
              onClick={onAddToCollection}
            >
              <PackagePlus className="w-4 h-4 text-icon" />
              Add to collection
            </Button>
          )}
        {selectedDatasets.length === 0 && missingDatasetIds.length === 0 ? (
          <NoData
            icon={Database}
            title="Your selected datasets will appear here"
            description="Choose some first"
          />
        ) : (
          <>
            {selectedDatasets.map((dataset: DatasetUnion) => {
              const isExpanded = expandedDatasets.includes(dataset.id);

              return (
                <SelectedDatasetItem
                  key={dataset.id}
                  dataset={dataset}
                  isExpanded={isExpanded}
                  onToggleExpanded={toggleExpanded}
                  onRemoveDataset={onRemoveDataset}
                  hideRemoveDataset={hideRemoveDataset}
                />
              );
            })}
            {/* Fallback for missing datasets */}
            {missingDatasetIds.map((id) => (
              <MissingDatasetItem
                key={id}
                id={id}
                displayName={selectedDatasetNamesMap[id] || id}
                onRemoveDataset={onRemoveDataset}
                hideRemoveDataset={hideRemoveDataset}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer actions: Deselect All and Chat with Data (stays at bottom of panel) */}
      {(onDeselectAll || onChatWithData) && (
        <div className="p-4 bg-white flex-shrink-0">
          <div className="flex flex-col gap-4">
            {onChatWithData && (
              <Button
                disabled={selectedDatasetIds.length === 0}
                variant="primary"
                className="flex-1 flex items-center gap-2"
                onClick={onChatWithData}
              >
                <Bot
                  className={`w-4 h-4 !stroke-icon ${
                    selectedDatasetIds.length === 0 ? "!stroke-slate-350" : ""
                  }`}
                />
                Chat with your data
              </Button>
            )}
            {onDeselectAll && (
              <Button
                disabled={selectedDatasetIds.length === 0}
                variant="outline"
                className="flex-1"
                onClick={onDeselectAll}
              >
                <ArrowUp
                  className={`w-4 h-4 !stroke-icon transform -rotate-45 mr-1 ${
                    selectedDatasetIds.length === 0 ? "!stroke-slate-350" : ""
                  }`}
                />
                Deselect All
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
