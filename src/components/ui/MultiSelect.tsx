"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Checkbox";

interface MultiSelectOption {
  value: string;
  label: string;
  code?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  searchable = false,
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions =
    searchable && searchTerm
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (option.code &&
              option.code.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : options;

  const handleToggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemoveOption = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue));
  };

  const getSelectedLabels = () => {
    return value.map((v) => {
      const option = options.find((o) => o.value === v);
      return option ? option.label : v;
    });
  };

  // If 7 or fewer options, show checkboxes directly without dropdown
  if (options.length <= 7) {
    return (
      <div className={cn("space-y-3", className)}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            id={`multiselect-${option.value}`}
            checked={value.includes(option.value)}
            onChange={() => handleToggleOption(option.value)}
            label={option.label}
          />
        ))}
      </div>
    );
  }

  // Show search only if searchable is true and there are more than 7 options
  const shouldShowSearch = searchable && options.length > 7;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div
        className="w-full px-3 py-2 border border-slate-300 rounded-md cursor-pointer bg-white flex items-center justify-between min-h-[40px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {value.length === 0 ? (
            <span className="text-slate-400 text-body-16-regular">
              {placeholder}
            </span>
          ) : (
            getSelectedLabels().map((label, index) => (
              <div
                key={index}
                className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-descriptions-12-medium"
              >
                {label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveOption(value[index]);
                  }}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-500 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50 max-h-60 overflow-y-auto">
          {shouldShowSearch && (
            <div className="p-2 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-850 placeholder-slate-400 text-body-14-regular"
                />
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer"
                onClick={() => handleToggleOption(option.value)}
              >
                <Checkbox
                  id={`multiselect-${option.value}`}
                  checked={value.includes(option.value)}
                  onChange={() => handleToggleOption(option.value)}
                  label={option.label}
                  className="w-full"
                />
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-slate-400 text-body-14-regular">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
