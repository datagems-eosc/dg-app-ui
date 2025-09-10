"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, X, AlertCircle } from "lucide-react";

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
  type?: "success" | "error";
}

export function Toast({
  message,
  isVisible,
  onClose,
  duration = 3000,
  type = "success",
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const isSuccess = type === "success";
  const icon = isSuccess ? CheckCircle : AlertCircle;
  const iconColor = isSuccess ? "text-green-500" : "text-red-500";
  const title = isSuccess ? "Success" : "Error";
  const titleColor = isSuccess ? "text-gray-900" : "text-red-900";

  const toastContent = (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm w-full">
        <div className="flex items-start gap-3">
          <div className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`}>
            {React.createElement(icon, { className: "w-5 h-5" })}
          </div>
          <div className="flex-1">
            <h4 className={`text-body-16-semibold ${titleColor} mb-1`}>
              {title}
            </h4>
            <p className="text-descriptions-12-regular text-gray-600">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-4 h-4 text-icon" />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
}
