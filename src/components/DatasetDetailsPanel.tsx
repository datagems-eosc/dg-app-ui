"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dataset } from "@/data/mockDatasets";
import DataPreviewModal from "./DataPreviewModal";

interface DatasetDetailsPanelProps {
  dataset: Dataset | null;
  onClose: () => void;
  isVisible: boolean;
}

interface Collection {
  id: string;
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

export default function DatasetDetailsPanel({
  dataset,
  onClose,
  isVisible,
}: DatasetDetailsPanelProps) {
  useEffect(() => {
    if (isVisible) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isVisible]);

  const [showPreview, setShowPreview] = useState(false);

  if (!isVisible || !dataset) {
    return null;
  }

  return (
    <>
      <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg z-40 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-H2-20-semibold text-gray-900">Dataset Details</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Title and Tags */}
          <div>
            <h3 className="text-H2-20-semibold text-gray-900 mb-3">
              {dataset.title}
            </h3>
            <div className="flex items-center gap-2 mb-4">
              {hasCollections(dataset) && dataset.collections.length > 0
                ? dataset.collections.map((col) => (
                    <span
                      key={col.id || col.name}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-descriptions-12-semibold bg-blue-100 text-blue-800"
                    >
                      {typeof col.name === "string"
                        ? col.name.replace(/ Collection$/i, "")
                        : col.name}
                    </span>
                  ))
                : null}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-descriptions-12-semibold ${
                  dataset.access === "Open Access"
                    ? "bg-green-100 text-green-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {dataset.access === "Open Access"
                  ? "Open Access"
                  : "Restricted"}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-descriptions-12-regular">
            <div>
              <p className="text-gray-500 mb-1">Published</p>
              <p className="text-gray-900">-</p>
            </div>
          </div>

          {/* Add to Collection */}
          {/* Removed Add to collection button */}

          {/* Description */}
          <div>
            <h4 className="text-body-16-semibold text-gray-900 mb-2">
              Description
            </h4>
            <p className="text-descriptions-12-regular text-gray-600">
              {dataset.description}
            </p>
          </div>

          {/* Data Preview */}
          <div>
            <h4 className="text-body-16-semibold text-gray-900 mb-3">
              Data preview
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-descriptions-12-regular">
                <span className="text-gray-500">File Size</span>
                <span className="text-gray-900">{dataset.size}</span>
              </div>
              <div className="flex items-center justify-between text-descriptions-12-regular">
                <span className="text-gray-500">File Type</span>
                <span className="text-gray-900">{dataset.mimeType || "-"}</span>
              </div>
              {/* Removed Show preview button */}
            </div>
          </div>

          {/* Metadata */}
          <div>
            <h4 className="text-body-16-semibold text-gray-900 mb-2">
              Metadata
            </h4>
            <div className="text-descriptions-12-regular text-gray-600">
              <p>Comprehensive dataset information available</p>
            </div>
          </div>

          {/* License */}
          <div>
            <h4 className="text-body-16-semibold text-gray-900 mb-2">
              License
            </h4>
            <p className="text-descriptions-12-regular text-gray-600">
              {dataset.license || "-"}
            </p>
          </div>

          {/* Field of Science */}
          <div>
            <h4 className="text-body-16-semibold text-gray-900 mb-2">
              Field of Science
            </h4>
            <p className="text-descriptions-12-regular text-gray-600">
              Computer and Information Sciences
            </p>
          </div>
        </div>
      </div>

      {/* Data Preview Modal */}
      <DataPreviewModal
        isVisible={showPreview}
        onClose={() => setShowPreview(false)}
        dataset={dataset}
      />
    </>
  );
}
