"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

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
  const icon = isSuccess ? CheckCircle2 : AlertCircle;
  const iconColor = isSuccess ? "text-emerald-500" : "text-red-500";
  const title = isSuccess ? "Success" : "Error";
  const titleColor = isSuccess ? "text-emerald-800" : "text-red-900";

  const toastContent = (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div
        className={`${isSuccess ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"} rounded-lg shadow-s1 border p-4 max-w-md w-full`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-6 h-6 ${iconColor} flex-shrink-0 mt-0.5`}>
            {React.createElement(icon, { className: "w-6 h-6" })}
          </div>
          <div className="flex-1">
            <h4 className={`text-body-16-semibold ${titleColor} mb-1`}>
              {title}
            </h4>
            <p
              className={`text-body-14-regular ${isSuccess ? "text-emerald-700" : "text-gray-600"}`}
            >
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${isSuccess ? "text-emerald-800 hover:text-emerald-900" : "text-gray-400 hover:text-gray-600"} flex-shrink-0 cursor-pointer`}
          >
            <X className="w-4 h-4" strokeWidth={1.25} />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
}
