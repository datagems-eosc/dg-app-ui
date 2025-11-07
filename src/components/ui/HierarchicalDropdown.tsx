"use client";

import {
  Atom,
  ChevronDown,
  Cpu,
  HeartPulse,
  Microscope,
  PersonStanding,
  Search,
  Speech,
  Trees,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Checkbox } from "./Checkbox";
import { Input } from "./Input";

export interface HierarchicalOption {
  value: string;
  label: string;
  code?: string;
}

export interface HierarchicalCategory {
  name: string;
  code: string;
  options: HierarchicalOption[];
}

interface HierarchicalDropdownProps {
  value: string[];
  onChange: (value: string[]) => void;
  categories: HierarchicalCategory[];
  placeholder?: string;
  searchPlaceholder?: string;
  noOptionsText?: string;
}

export default function HierarchicalDropdown({
  value,
  onChange,
  categories,
  placeholder = "Search...",
  searchPlaceholder = "Search...",
  noOptionsText = "No options found",
}: HierarchicalDropdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Ensure categories is always an array
  const safeCategories = Array.isArray(categories) ? categories : [];

  const toggleCategory = (categoryCode: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryCode)
        ? prev.filter((code) => code !== categoryCode)
        : [...prev, categoryCode],
    );
  };

  const handleToggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const filteredCategories = searchTerm
    ? safeCategories
        .map((category) => ({
          ...category,
          options: category.options.filter(
            (option) =>
              option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
              option.code?.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
        }))
        .filter((category) => category.options.length > 0)
    : safeCategories;

  // Auto-expand categories with search results
  useEffect(() => {
    if (searchTerm) {
      const categoriesWithResults = filteredCategories.map((cat) => cat.code);
      setExpandedCategories(categoriesWithResults);
    } else {
      setExpandedCategories([]);
    }
  }, [searchTerm, filteredCategories]);

  // Get selected count for a specific category
  const getSelectedCountForCategory = (category: HierarchicalCategory) => {
    return category.options.filter((option) => value.includes(option.value))
      .length;
  };

  const getCategoryIcon = (code: string) => {
    switch (code) {
      case "1":
        return Microscope;
      case "2":
        return Cpu;
      case "3":
        return HeartPulse;
      case "4":
        return Trees;
      case "5":
        return PersonStanding;
      case "6":
        return Speech;
      default:
        return Atom;
    }
  };

  return (
    <div className="w-full">
      {/* Search input at the top */}
      <div className="mb-4">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={searchPlaceholder}
          rightIcon={<Search className="w-4 h-4 icon" />}
        />
      </div>

      {/* Categories list */}
      <div className="space-y-2">
        {filteredCategories.map((category) => {
          const selectedCount = getSelectedCountForCategory(category);
          // Ensure category.code is a valid string for the key
          const categoryKey =
            typeof category.code === "string"
              ? category.code
              : `category-${Math.random()}`;

          return (
            <div
              key={categoryKey}
              className="border-b border-slate-200 last:border-b-0 pb-2"
            >
              <div
                className="flex items-center justify-between pr-4 pl-2 py-1 cursor-pointer"
                onClick={() => toggleCategory(category.code)}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = getCategoryIcon(category.code);
                    return <Icon className="w-4 h-4 text-slate-600" />;
                  })()}
                  <span className="text-sm text-slate-850">
                    {typeof category.name === "string"
                      ? category.name
                      : "Unknown Category"}
                  </span>
                  {selectedCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-tiny font-medium text-white bg-blue-600 rounded-full">
                      {selectedCount}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform ${
                    expandedCategories.includes(category.code)
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </div>
              {expandedCategories.includes(category.code) && (
                <div>
                  {category.options.map((option) => {
                    // Ensure option.value is a valid string for the key
                    const optionKey =
                      typeof option.value === "string"
                        ? option.value
                        : `option-${Math.random()}`;
                    const optionLabel =
                      typeof option.label === "string"
                        ? option.label
                        : "Unknown Option";

                    return (
                      <div
                        key={optionKey}
                        className="flex items-center pl-3 pr-6 py-2"
                      >
                        <Checkbox
                          id={`checkbox-${optionKey}`}
                          checked={value.includes(option.value)}
                          onChange={() => handleToggleOption(option.value)}
                          label={optionLabel}
                          className="w-full"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredCategories.length === 0 && (
          <div className="px-3 py-2 text-slate-400 text-body-14-regular text-center">
            {noOptionsText}
          </div>
        )}
      </div>
    </div>
  );
}
