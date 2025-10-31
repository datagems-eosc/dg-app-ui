"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dataset } from "@/data/dataset";
import Browse from "./Browse";

interface AddDatasetsModalProps {
  isVisible: boolean;
  onClose: () => void;
  datasets: Dataset[];
  onSelectedDatasetsChange: (selectedDatasets: string[]) => void;
}

export default function AddDatasetsModal({
  isVisible,
  onClose,
  datasets,
  onSelectedDatasetsChange,
}: AddDatasetsModalProps) {
  const [modalSelectedDatasets, setModalSelectedDatasets] = useState<string[]>(
    []
  );

  // Reset modal state when it opens
  useEffect(() => {
    if (isVisible) {
      setModalSelectedDatasets([]);
    }
  }, [isVisible]);

  const handleAddSelected = () => {
    console.log("Datasets added from modal:", modalSelectedDatasets);
    onSelectedDatasetsChange(modalSelectedDatasets);
    onClose();
  };

  const handleClose = () => {
    setModalSelectedDatasets([]);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-H2-20-semibold text-gray-900">Add Datasets</h2>
            <p className="text-descriptions-12-regular text-gray-600 mt-1">
              Select datasets to add to your collection
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Browse
            datasets={datasets}
            title=""
            subtitle=""
            showSelectAll={true}
            selectedDatasets={modalSelectedDatasets}
            onSelectedDatasetsChange={setModalSelectedDatasets}
            isModal={true}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 border-t border-gray-200 gap-4">
          <div className="text-descriptions-12-regular text-gray-600">
            {modalSelectedDatasets.length} dataset
            {modalSelectedDatasets.length !== 1 ? "s" : ""} selected
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={modalSelectedDatasets.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Selected ({modalSelectedDatasets.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
