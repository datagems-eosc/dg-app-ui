"use client";

import { Chip } from "@ui/Chip";
import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import { Tooltip } from "@ui/Tooltip";
import { useMemo } from "react";
import type { FilterState } from "@/config/filterOptions";

interface ActiveFiltersProps {
  filters: FilterState;
  fieldsOfScienceCategories: HierarchicalCategory[];
  licenses: { value: string; label: string }[];
  onRemoveFilter: (filterKey: keyof FilterState) => void;
  showSearchAndFilters?: boolean;
}

export default function ActiveFilters({
  filters,
  fieldsOfScienceCategories,
  licenses,
  onRemoveFilter,
  showSearchAndFilters = true,
}: ActiveFiltersProps) {
  // Generate active filter tags
  const activeFilterTags = useMemo(() => {
    const tags: Array<{
      key: string;
      label: string;
      value: string;
      fullValue?: string;
    }> = [];

    if (filters.access && filters.access !== "") {
      tags.push({
        key: "access",
        label: "Access",
        value: filters.access === "open" ? "Open" : "Restricted",
      });
    }

    if (filters.creationYear.start || filters.creationYear.end) {
      const from = filters.creationYear.start || "...";
      const to = filters.creationYear.end || "...";
      tags.push({
        key: "creationYear",
        label: "Creation Year",
        value: `${from}-${to}`,
      });
    }

    if (filters.datasetSize.start || filters.datasetSize.end) {
      const min = filters.datasetSize.start
        ? `${filters.datasetSize.start} MB`
        : "0 MB";
      const max = filters.datasetSize.end
        ? `${filters.datasetSize.end} MB`
        : "∞";

      tags.push({
        key: "datasetSize",
        label: "Dataset Size",
        value: `${min} - ${max}`,
      });
    }

    if (filters.fieldsOfScience.length > 0) {
      // Get the exact names of selected fields of science
      const selectedFieldNames = filters.fieldsOfScience.map((fieldCode) => {
        for (const category of fieldsOfScienceCategories) {
          const option = category.options.find(
            (opt) => opt.value === fieldCode,
          );
          if (option) {
            return option.label;
          }
        }
        return fieldCode; // fallback to code if not found
      });

      const fullValue = selectedFieldNames.join(", ");

      // If more than 2 fields selected, show first 2 + count of remaining
      if (selectedFieldNames.length > 2) {
        const firstTwo = selectedFieldNames.slice(0, 2).join(", ");
        const remaining = selectedFieldNames.length - 2;
        tags.push({
          key: "fieldsOfScience",
          label: "Field of Science",
          value: `${firstTwo} +${remaining} more`,
          fullValue,
        });
      } else {
        tags.push({
          key: "fieldsOfScience",
          label: "Field of Science",
          value: fullValue,
        });
      }
    }

    if (filters.license.length > 0) {
      // Get the exact names of selected licenses
      const selectedLicenseNames = filters.license.map((licenseCode) => {
        const licenseOption = licenses.find((opt) => opt.value === licenseCode);
        return licenseOption ? licenseOption.label : licenseCode; // fallback to code if not found
      });

      const fullValue = selectedLicenseNames.join(", ");

      // If more than 2 licenses selected, show first 2 + count of remaining
      if (selectedLicenseNames.length > 2) {
        const firstTwo = selectedLicenseNames.slice(0, 2).join(", ");
        const remaining = selectedLicenseNames.length - 2;
        tags.push({
          key: "license",
          label: "License",
          value: `${firstTwo} +${remaining} more`,
          fullValue,
        });
      } else {
        tags.push({
          key: "license",
          label: "License",
          value: fullValue,
        });
      }
    }

    return tags;
  }, [filters, fieldsOfScienceCategories, licenses]);

  if (showSearchAndFilters === false || activeFilterTags.length === 0) {
    return null;
  }

  return (
    <div
      role="list"
      aria-label="Active filters"
      className="flex gap-2 mb-4 flex-nowrap sm:flex-wrap overflow-x-auto pl-4 sm:px-6"
    >
      {activeFilterTags.map((tag) => {
        const chipContent = (
          <Chip
            className="flex-none"
            color="grey"
            onRemove={() => onRemoveFilter(tag.key as keyof FilterState)}
          >
            <span className="text-descriptions-12-medium text-gray-650">
              {tag.label}:
            </span>
            <span className="text-descriptions-12-medium ml-1 text-gray-750">
              {tag.value}
            </span>
          </Chip>
        );

        // Show tooltip only if the value is truncated (has fullValue that differs from displayed value)
        if (tag.fullValue && tag.fullValue !== tag.value) {
          return (
            <div
              key={tag.key}
              role="listitem"
              aria-label={`${tag.label}: ${tag.fullValue}`}
            >
              <Tooltip content={tag.fullValue} position="top" delay={300}>
                {chipContent}
              </Tooltip>
            </div>
          );
        }

        return (
          <div
            key={tag.key}
            role="listitem"
            aria-label={`${tag.label}: ${tag.value}`}
          >
            {chipContent}
          </div>
        );
      })}
    </div>
  );
}
