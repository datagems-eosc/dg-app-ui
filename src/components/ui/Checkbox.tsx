import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: CheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center cursor-pointer transition-colors rounded group",
        className
      )}
      onClick={handleClick}
    >
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          onClick={(e) => e.stopPropagation()}
        />
        <div
          className={cn(
            "w-4 h-4 border rounded flex items-center justify-center transition-colors group-hover:border-slate-350",
            checked
              ? "bg-blue-850 border-blue-850 group-hover:bg-blue-650 group-hover:border-blue-650"
              : "bg-white border-slate-200 group-hover:border-slate-350",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {checked && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            "ml-2 text-sm cursor-pointer select-none",
            disabled ? "text-gray-400" : "text-gray-750"
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
}
