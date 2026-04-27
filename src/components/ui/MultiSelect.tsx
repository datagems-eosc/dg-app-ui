"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Checkbox";
import { Chip } from "./Chip";
import { Input } from "./Input";

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
  variant?: "dropdown" | "inline";
  searchPlaceholder?: string;
  noOptionsText?: string;
  listClassName?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  searchable = false,
  className,
  variant = "dropdown",
  searchPlaceholder = "Search...",
  noOptionsText = "No options found",
  listClassName,
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
            option.code?.toLowerCase().includes(searchTerm.toLowerCase()),
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

  const getSelectedLabels = () =>
    value.map((v) => {
      const option = options.find((o) => o.value === v);
      return option ? option.label : v;
    });

  const shouldShowSearch =
    searchable && (variant === "inline" || options.length > 7);

  if (variant === "inline") {
    return (
      <div className={cn("space-y-3", className)}>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {getSelectedLabels().map((label, index) => (
              <Chip
                key={`${value[index]}-${label}`}
                color="grey"
                size="xs"
                onRemove={() => handleRemoveOption(value[index])}
              >
                {label}
              </Chip>
            ))}
          </div>
        )}
        {shouldShowSearch && (
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            rightIcon={<Search className="w-4 h-4 icon" />}
          />
        )}
        <div
          className={cn(
            "max-h-56 overflow-y-auto border border-slate-200 rounded-md",
            listClassName,
          )}
        >
          {filteredOptions.map((option) => (
            <div
              key={option.value}
              className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-200 last:border-b-0"
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
              {noOptionsText}
            </div>
          )}
        </div>
      </div>
    );
  }

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
            <div
              className="flex flex-wrap gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {getSelectedLabels().map((label, index) => (
                <Chip
                  key={`${value[index]}-${label}`}
                  color="grey"
                  size="xs"
                  onRemove={() => handleRemoveOption(value[index])}
                >
                  {label}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-500 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50 max-h-60 overflow-y-auto">
          {shouldShowSearch && (
            <div className="p-2 border-b border-slate-200">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                rightIcon={<Search className="w-4 h-4 icon" />}
              />
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
                {noOptionsText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
