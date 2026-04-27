"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface SuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
}

export function SuccessModal({
  isVisible,
  onClose,
  title,
  message,
  buttonText = "OK",
}: SuccessModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>("button")?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
      clearTimeout(timer);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-lg max-w-[95%] sm:max-w-[400px] w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-8 pb-4">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2
              id="success-modal-title"
              className="text-H6-18-semibold text-slate-850 mb-2"
            >
              {title}
            </h2>
            <p className="text-body-14-regular text-gray-600">{message}</p>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-center">
          <Button
            variant="primary"
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 px-8"
            aria-label={buttonText}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
