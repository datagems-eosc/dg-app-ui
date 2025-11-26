"use client";

import { Button } from "@ui/Button";
import { Trash2, X } from "lucide-react";

interface DeleteCollectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  collectionName?: string;
  isLoading?: boolean;
}

export default function DeleteCollectionModal({
  isVisible,
  onClose,
  onConfirm,
  collectionName = "this collection",
  isLoading = false,
}: DeleteCollectionModalProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Delete Collection
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Message */}
          <div className="text-center mb-6">
            <p className="text-gray-900 font-medium mb-2">
              This operation will permanently delete the collection. Are you
              sure?
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
