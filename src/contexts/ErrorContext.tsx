"use client";

import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { Toast } from "@/components/ui/Toast";

interface ErrorContextValue {
  showError: (message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

interface ToastState {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
  duration: number;
}

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "error",
    isVisible: false,
    duration: 5000,
  });

  const showError = useCallback((message: string, duration = 5000) => {
    setToast({
      message,
      type: "error",
      isVisible: true,
      duration,
    });
  }, []);

  const showSuccess = useCallback((message: string, duration = 3000) => {
    setToast({
      message,
      type: "success",
      isVisible: true,
      duration,
    });
  }, []);

  const clearError = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  return (
    <ErrorContext.Provider value={{ showError, showSuccess, clearError }}>
      {children}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={clearError}
        duration={toast.duration}
        type={toast.type}
      />
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error("useError must be used within an ErrorProvider");
  }
  return context;
}
