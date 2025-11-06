import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ChipProps {
  children: React.ReactNode;
  variant?: "outline" | "regular";
  color?:
    | "warning"
    | "info"
    | "success"
    | "error"
    | "default"
    | "grey"
    | "smart-search";
  size?: "xs" | "sm" | "md";
  className?: string;
  onRemove?: () => void;
}

export function Chip({
  children,
  variant = "regular",
  color = "default",
  size = "md",
  className,
  onRemove,
}: ChipProps) {
  const baseStyles = "inline-flex items-center rounded-full tracking-1p";

  const sizes = {
    xs: "px-2 py-0.5",
    sm: "px-3 py-0.5",
    md: "px-3 py-1.5",
  };

  const variants = {
    outline: "border border-slate-350 bg-white",
    regular: "border",
  };

  const colors = {
    warning: {
      regular: "border-orange-50 bg-orange-50 text-orange-700",
      outline: "border-orange-200 bg-orange-50 text-orange-700",
    },
    info: {
      regular: "border-blue-50 bg-blue-50 text-blue-700",
      outline: "border-slate-200 bg-white text-slate-850",
    },
    success: {
      regular: "border-green-50 bg-green-50 text-emerald-800",
      outline: "border-green-200 bg-green-50 text-emerald-800",
    },
    error: {
      regular: "border-red-50 bg-red-50 text-red-700",
      outline: "border-red-200 bg-red-50 text-red-700",
    },
    default: {
      regular: "border-gray-50 bg-gray-50 text-gray-700",
      outline: "border-gray-200 bg-gray-50 text-gray-700",
    },
    grey: {
      regular: "border-gray-100 bg-gray-100 text-gray-650",
      outline: "border-gray-300 bg-gray-100 text-gray-650",
    },
    "smart-search": {
      regular: "border-emerald-400 bg-white text-emerald-800",
      outline: "border-emerald-400 bg-white text-emerald-800",
    },
  };

  return (
    <span
      className={cn(
        baseStyles,
        sizes[size],
        // Allow external overrides for spacing/etc.
        className,
        // Component-provided visual styles
        variants[variant],
        colors[color][variant],
        // Typography (explicit Tailwind utilities to avoid twMerge dropping custom class)
        "font-medium text-[12px] leading-[150%]"
      )}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 ml-1 rounded-full cursor-pointer"
        >
          <X className="w-4 h-4 text-icon" />
        </button>
      )}
    </span>
  );
}
