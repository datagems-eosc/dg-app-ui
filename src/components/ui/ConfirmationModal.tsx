"use client";

import React from "react";
import { Trash, X } from "lucide-react";
import { Button } from "./Button";

interface ConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message1: string;
  message2: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isVisible,
  onClose,
  onConfirm,
  title,
  message1,
  message2,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  icon,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-md max-w-[95%] sm:max-w-[468px] w-full"
        onClick={handleModalClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4.5">
          <h2 className="text-H6-18-semibold text-slate-850">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-2 hover:bg-slate-100 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-6">
          {/* Icon */}
          {icon && (
            <div className="flex justify-center mb-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  confirmVariant === "danger" ? "bg-red-100" : "bg-blue-100"
                }`}
              >
                {icon}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="text-center mb-4">
            <p className="text-slate-850 text-body-16-medium">{message1}</p>
            <p className="pt-2 text-grey-750 text-body-14-regular">
              {message2}
            </p>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-11"
          >
            <X className="w-4 h-4 text-icon" strokeWidth={1.25} />
            {cancelText}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 ${
              confirmVariant === "danger"
                ? "bg-red-550 border border-red-550 hover:bg-red-600 hover:border-red-600 px-11"
                : ""
            }`}
          >
            <Trash className="w-4 h-4 text-icon" strokeWidth={1.25} />
            {isLoading ? "Loading..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
