"use client";

import { Button } from "@ui/Button";
import MissingDatasetItem from "@ui/datasets/MissingDatasetItem";
import SelectedDatasetItem from "@ui/datasets/SelectedDatasetItem";
import { NoData } from "@ui/NoData";
import { Tooltip } from "@ui/Tooltip";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronUp,
  Database,
  PackagePlus,
  X,
} from "lucide-react";
import React from "react";
import type { DatasetPackage } from "@/data/package";
import type { DatasetUnion } from "@/types/datasets";
import styles from "./SelectedDatasetsPanel.module.scss";

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
  selectedPackageIds?: string[];
  packages?: DatasetPackage[];
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
  selectedPackageIds = [],
  packages = [],
}: SelectedDatasetsPanelProps) {
  const [expandedDatasets, setExpandedDatasets] = React.useState<string[]>([]);
  const [expandedPackages, setExpandedPackages] = React.useState<string[]>([]);

  const selectedDatasets = datasets.filter((dataset) =>
    selectedDatasetIds.includes(dataset.id),
  );
  const missingDatasetIds = selectedDatasetIds.filter(
    (id) => !selectedDatasets.some((ds) => ds.id === id),
  );
  const selectedPackages = packages.filter((p) =>
    selectedPackageIds.includes(p.id),
  );
  const datasetIdsInPackages = new Set(
    selectedPackages.flatMap((p) => p.datasetIds),
  );
  const orphanDatasetIds = selectedDatasetIds.filter(
    (id) => !datasetIdsInPackages.has(id),
  );
  const orphanDatasets = selectedDatasets.filter((d) =>
    orphanDatasetIds.includes(d.id),
  );
  const orphanMissingIds = missingDatasetIds.filter((id) =>
    orphanDatasetIds.includes(id),
  );

  const toggleExpanded = (datasetId: string) => {
    setExpandedDatasets((prev) =>
      prev.includes(datasetId)
        ? prev.filter((id) => id !== datasetId)
        : [...prev, datasetId],
    );
  };

  const togglePackageExpanded = (packageId: string) => {
    setExpandedPackages((prev) =>
      prev.includes(packageId)
        ? prev.filter((id) => id !== packageId)
        : [...prev, packageId],
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
              <Tooltip content="Close panel" position="bottom" delay={300}>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-slate-75 rounded-sm transition-colors"
                >
                  <X className="w-5 h-5 text-icon" />
                </button>
              </Tooltip>
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
        {selectedDatasetIds.length === 0 ? (
          <NoData
            icon={Database}
            title="Your selected datasets will appear here"
            description="Choose some first"
          />
        ) : (
          <>
            {selectedPackages.map((pkg) => {
              const isPkgExpanded = expandedPackages.includes(pkg.id);
              const pkgDatasets = selectedDatasets.filter((d) =>
                pkg.datasetIds.includes(d.id),
              );
              const pkgMissingIds = pkg.datasetIds.filter(
                (id) => !selectedDatasets.some((ds) => ds.id === id),
              );

              return (
                <div key={pkg.id} className={styles.packageSection}>
                  <button
                    type="button"
                    onClick={() => togglePackageExpanded(pkg.id)}
                    className={styles.packageHeader}
                    aria-expanded={isPkgExpanded}
                  >
                    <div className={styles.packageTitleRow}>
                      <span className={styles.packageTitle}>{pkg.title}</span>
                      {isPkgExpanded ? (
                        <ChevronUp
                          className={`${styles.packageChevron} w-5 h-5`}
                          aria-hidden
                        />
                      ) : (
                        <ChevronDown
                          className={`${styles.packageChevron} w-5 h-5`}
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className={styles.packageChip}>
                      {pkg.datasetIds.length}{" "}
                      {pkg.datasetIds.length === 1 ? "dataset" : "datasets"}
                    </span>
                  </button>
                  {isPkgExpanded && (
                    <div className={styles.packageContent}>
                      <div className={styles.packageList}>
                        {pkgDatasets.map((dataset) => {
                          const isExpanded = expandedDatasets.includes(
                            dataset.id,
                          );
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
                        {pkgMissingIds.map((id) => (
                          <MissingDatasetItem
                            key={id}
                            id={id}
                            displayName={selectedDatasetNamesMap[id] || id}
                            onRemoveDataset={onRemoveDataset}
                            hideRemoveDataset={hideRemoveDataset}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {orphanDatasets.map((dataset) => {
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
            {orphanMissingIds.map((id) => (
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
