"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowDownUp } from "lucide-react";
import { Radio } from "./ui/Radio";

interface SortingOption {
  value: string;
  label: string;
}

interface SortingDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SortingOption[];
  triggerLabel?: string;
  className?: string;
}

export default function SortingDropdown({
  value,
  onChange,
  options,
  triggerLabel = "Sort by",
  className,
}: SortingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center gap-1 py-2 rounded-md text-body-14-regular text-gray-650">
        <ArrowDownUp className="w-4 h-4 text-icon" />
        <span>{triggerLabel}:</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-750 !underline text-body-14-medium cursor-pointer hover:text-gray-900 transition-colors focus-visible:outline-none"
        >
          {selectedOption?.label || "Name (A-Z)"}
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 w-70 bg-white rounded-lg shadow-s3 border border-slate-200 z-50 right-0">
          <div className="px-6 py-4">
            <h3 className="text-body-16-semibold text-gray-850">Sort by</h3>
          </div>

          <div className="px-6 pb-4">
            <Radio
              name="sorting"
              options={options}
              value={value}
              onChange={(newValue) => {
                onChange(newValue);
                setIsOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
