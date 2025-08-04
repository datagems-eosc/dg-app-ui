"use client";

import React, { useEffect, useRef } from "react";
import { X, Plus, MessageSquare, Database } from "lucide-react";
import type { Dataset as MockDataset } from "@/data/mockDatasets";
import { Button } from "./ui/Button";
import { NoData } from "./ui/NoData";
import SelectedDatasetItem from "./ui/datasets/SelectedDatasetItem";
import MissingDatasetItem from "./ui/datasets/MissingDatasetItem";
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
}: SelectedDatasetsPanelProps) {
  const [expandedDatasets, setExpandedDatasets] = React.useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedDatasets = datasets.filter((dataset) =>
    selectedDatasetIds.includes(dataset.id)
  );
  // Add fallback for missing datasets
  const missingDatasetIds = selectedDatasetIds.filter(
    (id) => !selectedDatasets.some((ds) => ds.id === id)
  );

  const toggleExpanded = (datasetId: string) => {
    setExpandedDatasets((prev) =>
      prev.includes(datasetId)
        ? prev.filter((id) => id !== datasetId)
        : [...prev, datasetId]
    );
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose?.();
      }
    };

    if (onClose) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [onClose]);

  console.log("selectedDatasets", selectedDatasets);
  console.log("datasets", datasets);

  return (
    <div
      className="h-full w-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto scrollbar-hide hide-scrollbar"
      ref={panelRef}
    >
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

        {onAddToCollection && !hideAddToCollection && (
          <Button
            variant="outline"
            className="w-full flex items-center gap-2 mb-4"
            onClick={onAddToCollection}
          >
            <Plus className="w-4 h-4 text-icon" />
            Add to collection
          </Button>
        )}
      </div>

      {/* Selected Datasets List */}
      <div className="p-4 space-y-4">
        {selectedDatasets.length === 0 && missingDatasetIds.length === 0 ? (
          <NoData
            icon={Database}
            title="Your selected datasets will appear here"
            description="Your selected datasets will appear here"
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

      {/* Chat with Data button */}
      {onChatWithData && (
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="primary"
            className="w-full flex items-center gap-2"
            onClick={onChatWithData}
          >
            <MessageSquare className="w-4 h-4 text-icon" />
            Chat with your data
          </Button>
        </div>
      )}
    </div>
  );
}
