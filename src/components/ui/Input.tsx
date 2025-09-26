"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "medium" | "large";
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  required?: boolean;
}

export function Input({
  size = "medium",
  className,
  name,
  label,
  error,
  icon,
  rightIcon,
  required,
  disabled,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={name}
          className={cn(
            "block text-sm font-medium mb-1",
            disabled
              ? "text-gray-650"
              : error
                ? "text-red-550"
                : "text-gray-750"
          )}
        >
          {label}
          {required && <span className="ml-0.5 text-red-550">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {icon}
          </div>
        )}
        <input
          id={name}
          disabled={disabled}
          className={cn(
            "w-full px-3 border rounded-4xl text-sm font-normal transition-colors",
            // Size-based padding
            size === "large" ? "py-2.25" : "py-1.75",
            // Base styles
            "border-slate-350 text-gray-750 placeholder-slate-400",
            // Icon padding
            icon && "pl-10",
            rightIcon && "pr-10",
            // Hover state
            "hover:border-slate-450",
            // Focus state
            // Cross-browser consistent focus: outer 2px blue ring, 1px offset gap, keep inner border slate
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1 focus-visible:ring-offset-white focus-visible:text-gray-750",
            // Filled state (when input has value)
            "peer",
            // Error state
            error &&
              // Keep red border and use red ring with same geometry
              "border-red-550 text-gray-750 focus-visible:ring-red-550",
            // Disabled state
            disabled &&
              "border-slate-200 text-slate-450 bg-slate-75 cursor-not-allowed hover:border-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-slate-200",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div
            className={`absolute flex right-3 top-1/2 transform -translate-y-1/2 ${
              size === "large" ? "top-1/2" : "top-1/2"
            }`}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-descriptions-12-regular text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
