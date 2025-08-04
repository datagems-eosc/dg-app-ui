"use client";

import React from "react";
import { X } from "lucide-react";

interface MissingDatasetItemProps {
  id: string;
  displayName: string;
  onRemoveDataset: (id: string) => void;
  hideRemoveDataset?: boolean;
}

export default function MissingDatasetItem({
  id,
  displayName,
  onRemoveDataset,
  hideRemoveDataset = false,
}: MissingDatasetItemProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 flex items-center justify-between">
        <h3 className="text-body-16-semibold text-gray-900 line-clamp-2">
          {displayName}
        </h3>
        <button
          disabled={hideRemoveDataset}
          onClick={() => !hideRemoveDataset && onRemoveDataset(id)}
          className={`flex-shrink-0 p-1 rounded-md transition-colors ml-2 ${
            hideRemoveDataset
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-gray-200"
          }`}
          title={
            hideRemoveDataset ? undefined : "Remove this dataset"
          }
        >
          <X className="w-4 h-4 text-icon" />
        </button>
      </div>
      <div className="p-4 bg-white border-t border-gray-200 text-descriptions-12-regular text-gray-600">
        Dataset details not available.
      </div>
    </div>
  );
} 