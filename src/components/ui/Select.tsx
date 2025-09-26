"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps {
  options?: SelectOption[];
  groupedOptions?: SelectOptionGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  onSelectionChange?: (option: SelectOption | null) => void;
  required?: boolean;
}

export function Select({
  options = [],
  groupedOptions,
  value,
  onChange,
  placeholder = "Select an option",
  label,
  error,
  required,
  disabled = false,
  onSelectionChange,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const flatOptions = groupedOptions
    ? groupedOptions.flatMap((group) => group.options)
    : options;

  const selectedOption = flatOptions.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    onSelectionChange?.(option);
    setIsOpen(false);
  };

  return (
    <div className="w-full" ref={selectRef}>
      {label && (
        <label
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
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-1.75 border rounded-4xl text-sm font-normal transition-colors text-left flex items-center justify-between",
            "border-slate-350 hover:border-slate-450",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1 focus-visible:ring-offset-white",
            error && "border-red-550 focus-visible:ring-red-550",
            disabled &&
              "border-slate-200 bg-slate-75 cursor-not-allowed hover:border-slate-200 focus-visible:ring-0",
            selectedOption ? "text-gray-750" : "text-slate-400"
          )}
        >
          <span className="truncate flex items-center gap-2 min-w-0">
            {selectedOption?.icon && (
              <span className="flex-shrink-0 text-icon w-4 h-4 inline-flex items-center justify-center">
                {selectedOption.icon}
              </span>
            )}
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform flex-shrink-0 ml-2",
              isOpen && "rotate-180",
              disabled ? "text-slate-350" : "text-slate-500"
            )}
          />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-md max-h-60 overflow-y-auto p-1">
            {(
              groupedOptions ? flatOptions.length === 0 : options.length === 0
            ) ? (
              <div className="px-3 py-2 text-sm text-slate-400">
                No options available
              </div>
            ) : groupedOptions ? (
              <div>
                {groupedOptions.map((group, gi) => (
                  <div key={`group-${gi}`} className={cn(gi > 0 && "pt-2")}>
                    <div className="text-descriptions-12-medium text-slate-450 uppercase !tracking-wider m-2">
                      {group.label}
                    </div>
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className={cn(
                          "w-full text-left text-sm transition-colors rounded-md group mb-1 last:mb-0",
                          value === option.value
                            ? "bg-slate-200"
                            : "hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center pl-4 pr-3 py-2">
                          {option.icon && (
                            <span className="mr-3 w-4 h-4 text-icon inline-flex items-center justify-center">
                              {option.icon}
                            </span>
                          )}
                          <span className="flex-1 truncate text-body-14-regular text-slate-950">
                            {option.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full text-left text-sm transition-colors rounded-md group mb-1 last:mb-0",
                    value === option.value
                      ? "bg-slate-200"
                      : "hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-center px-3 py-2">
                    {option.icon && (
                      <span className="mr-3 w-4 h-4 text-icon inline-flex items-center justify-center">
                        {option.icon}
                      </span>
                    )}
                    <span className="flex-1 truncate text-body-14-regular text-slate-950">
                      {option.label}
                    </span>
                  </div>
                </button>
              ))
            )}
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
