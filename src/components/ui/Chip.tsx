import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ChipProps {
  children: React.ReactNode;
  variant?: "outline" | "regular";
  color?: "warning" | "info" | "success" | "error" | "default" | "grey";
  size?: "sm" | "md";
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
    sm: "px-3 py-0.5",
    md: "px-3 py-1.5",
  };

  const variants = {
    outline: "border border-slate-350 bg-white text-gray-750",
    regular: "border",
  };

  const colors = {
    warning: {
      regular: "border-orange-50 bg-orange-50 text-orange-700",
      outline: "border-orange-200 bg-orange-50 text-orange-700",
    },
    info: {
      regular: "border-blue-50 bg-blue-50 text-blue-700",
      outline: "border-slate-200 bg-white text-gray-650",
    },
    success: {
      regular: "border-green-50 bg-green-50 text-green-700",
      outline: "border-green-200 bg-green-50 text-green-700",
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
  };

  return (
    <span
      className={cn(
        baseStyles,
        sizes[size],
        variants[variant],
        colors[color][variant],
        "text-descriptions-12-medium",
        className
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
