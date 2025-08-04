"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  className,
  name,
  label,
  error,
  icon,
  rightIcon,
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
            "w-full px-3 py-1.75 border rounded-4xl text-sm font-normal transition-colors",
            // Base styles
            "border-slate-350 text-gray-850 placeholder-slate-400",
            // Icon padding
            icon && "pl-10",
            rightIcon && "pr-10",
            // Hover state
            "hover:border-slate-450",
            // Focus state
            "focus-visible:ring-2 focus-visible:ring-[#2B7FFF33] focus-visible:border-blue-850 focus-visible:text-gray-750",
            // Filled state (when input has value)
            "peer",
            // Error state
            error &&
              "border-red-550 text-gray-750 focus:ring-red-550 focus:border-red-550",
            // Disabled state
            disabled &&
              "border-slate-200 text-slate-450 bg-slate-75 cursor-not-allowed hover:border-slate-200 focus:ring-0 focus:border-slate-200",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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
