import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "secondary" | "ghost";
  size?: "icon" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-3xl shadow-s1 transition-all duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-blue-850 disabled:pointer-events-none group relative overflow-hidden";

  const variants = {
    primary:
      "bg-sky-950 !text-white hover:bg-sky-900 active:bg-sky-950 hover:shadow-s1 focus-visible:ring-blue-500 disabled:bg-slate-350 disabled:shadow-none !disabled:text-slate-450 [&>svg]:stroke-white hover:[&>svg]:stroke-white active:[&>svg]:stroke-white disabled:[&>svg]:stroke-white/50",
    outline:
      "border border-slate-350 bg-white !text-gray-750 hover:bg-slate-75 hover:!text-gray-750 active:bg-slate-100 focus-visible:!text-gray-750 disabled:!text-slate-350 disabled:border-slate-200 disabled:shadow-none [&>svg]:stroke-gray-750 hover:[&>svg]:stroke-gray-750 active:[&>svg]:stroke-gray-750 disabled:[&>svg]:stroke-slate-350",
    secondary:
      "bg-gray-100 !text-black hover:bg-gray-200 hover:!text-black active:bg-gray-300 active:!text-black hover:shadow-md focus-visible:ring-gray-500 disabled:opacity-50 [&>svg]:stroke-black hover:[&>svg]:stroke-black active:[&>svg]:stroke-black disabled:[&>svg]:stroke-black/50",
    ghost:
      "bg-transparent !text-black hover:bg-gray-100 hover:!text-black active:bg-gray-200 active:!text-black hover:shadow-sm focus-visible:ring-gray-500 disabled:opacity-50 [&>svg]:stroke-black hover:[&>svg]:stroke-black active:[&>svg]:stroke-black disabled:[&>svg]:stroke-black/50",
  };

  const sizes = {
    icon: "h-8 w-8 p-1",
    sm: "h-8 px-4 py-2",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-6",
  };

  const typography = {
    sm: "text-descriptions-12-medium",
    md: "text-body-14-medium",
    lg: "text-body-14-medium",
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        typography[size],
        className
      )}
      {...props}
    >
      {/* Subtle shimmer effect for primary buttons */}
      {variant === "primary" && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                      transform -skew-x-12 -translate-x-full group-hover:translate-x-full 
                      transition-transform duration-1000 ease-out pointer-events-none"
        />
      )}
      {children}
    </button>
  );
}
