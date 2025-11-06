"use client";

import type React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  characterCount?: boolean;
  maxLength?: number;
  required?: boolean;
}

export function Textarea({
  className,
  name,
  label,
  error,
  required,
  disabled,
  characterCount = false,
  maxLength,
  value = "",
  ...props
}: TextareaProps) {
  const currentLength = typeof value === "string" ? value.length : 0;

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
        <textarea
          id={name}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          className={cn(
            "w-full px-3 py-2 border rounded-2xl text-sm font-normal transition-colors resize-none",
            // Base styles
            "border-slate-350 text-gray-750 placeholder-slate-400",
            // Hover state
            "hover:border-slate-450",
            // Focus state
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1 focus-visible:ring-offset-white focus-visible:text-gray-750",
            // Error state
            error && "border-red-550 text-gray-750 focus-visible:ring-red-550",
            // Disabled state
            disabled &&
              "border-slate-200 text-slate-450 bg-slate-75 cursor-not-allowed hover:border-slate-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-slate-200",
            className
          )}
          {...props}
        />
        {characterCount && maxLength && (
          <div className="absolute bottom-2 right-3 text-xs text-gray-650">
            {currentLength}/{maxLength}
          </div>
        )}
      </div>
      {characterCount && !maxLength && (
        <div className="mt-1 text-xs text-gray-650 text-right">
          {currentLength}/3000
        </div>
      )}
      {error && (
        <p className="mt-1 text-descriptions-12-regular text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
