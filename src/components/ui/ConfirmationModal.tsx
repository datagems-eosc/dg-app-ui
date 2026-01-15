"use client";

import { X } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleFocusTrap);
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>("button")?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleFocusTrap);
      document.body.style.overflow = "unset";
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [isVisible, onClose, isLoading]);

  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-md max-w-[95%] sm:max-w-[468px] w-full"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4.5">
          <h2 id="modal-title" className="text-H6-18-semibold text-slate-850">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-sm p-2 hover:bg-slate-100 transition-colors"
            disabled={isLoading}
            aria-label="Close modal"
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

          <div id="modal-description" className="text-center mb-4">
            <p className="text-slate-850 text-body-16-medium">{message1}</p>
            <p className="pt-2 text-body-14-regular text-gray-750">
              {message2}
            </p>
          </div>
        </div>
        <div className="flex justify-center gap-2 border-t border-slate-200 p-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-11"
            aria-label={cancelText}
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
                : "px-11"
            }`}
            aria-label={isLoading ? "Loading..." : confirmText}
          >
            {isLoading ? "Loading..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
