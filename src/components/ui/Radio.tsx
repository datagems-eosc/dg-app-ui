"use client";

import { cn } from "@/lib/utils";

interface RadioOption {
  value: string;
  label: string;
}

interface RadioProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function Radio({
  name,
  options,
  value,
  onChange,
  className,
  disabled = false,
}: RadioProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex items-center cursor-pointer group",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <div className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="sr-only"
            />
            <div
              className={cn(
                "w-4 h-4 border-1 rounded-full flex items-center justify-center transition-colors",
                disabled
                  ? "border-slate-450"
                  : value === option.value
                    ? "border-blue-650"
                    : "border-slate-350 group-hover:border-slate-450"
              )}
            >
              {value === option.value && (
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    disabled ? "bg-slate-450" : "bg-blue-650"
                  )}
                ></div>
              )}
            </div>
          </div>
          <span
            className={cn(
              "ml-2 text-body-14-regular transition-colors",
              disabled ? "!text-slate-450" : "!text-gray-750"
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
