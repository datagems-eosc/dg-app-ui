"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/Button";
import { Radio } from "./ui/Radio";
import { Input } from "./ui/Input";
import { MultiSelect } from "./ui/MultiSelect";
import HierarchicalDropdown from "./ui/HierarchicalDropdown";
import {
  ACCESS_OPTIONS,
  FilterState,
  VALIDATION_CONFIG,
  fetchFieldsOfScience,
  fetchLicenses,
} from "../config/filterOptions";
import { HierarchicalCategory } from "./ui/HierarchicalDropdown";
import { useSession } from "next-auth/react";

export default function FilterModal({
  isVisible,
  onClose,
  onApplyFilters,
  currentFilters,
}: {
  isVisible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  currentFilters: FilterState;
}) {
  const { data: session } = useSession() as any;
  const [filters, setFilters] = useState<FilterState>(currentFilters);
  const [yearErrors, setYearErrors] = useState({ start: "", end: "" });
  const [sizeErrors, setSizeErrors] = useState({ start: "", end: "" });
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<{ value: string; label: string }[]>(
    []
  );
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(true);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancel();
      }
    };

    if (isVisible) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isVisible]);

  // Sync local filters with currentFilters when they change
  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  // Fetch fields of science and licenses when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      const token = session?.accessToken;

      // Fetch fields of science
      setIsLoadingFields(true);
      fetchFieldsOfScience(token)
        .then((categories) => {
          setFieldsOfScienceCategories(categories);
        })
        .catch((error) => {
          console.error("Error fetching fields of science:", error);
          setFieldsOfScienceCategories([]);
        })
        .finally(() => {
          setIsLoadingFields(false);
        });

      // Fetch licenses
      setIsLoadingLicenses(true);
      fetchLicenses(token)
        .then((licenseOptions) => {
          setLicenses(licenseOptions);
        })
        .catch((error) => {
          console.error("Error fetching licenses:", error);
          setLicenses([]);
        })
        .finally(() => {
          setIsLoadingLicenses(false);
        });
    }
  }, [isVisible, session]);

  if (!isVisible) {
    return null;
  }

  const validateYear = (value: string): boolean => {
    if (!value) return true;
    const year = parseInt(value);
    return (
      !isNaN(year) &&
      year >= VALIDATION_CONFIG.year.min &&
      year <= VALIDATION_CONFIG.year.max
    );
  };

  const validateSize = (value: string): boolean => {
    if (!value) return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= VALIDATION_CONFIG.size.min;
  };

  const handleYearChange = (field: "start" | "end", value: string) => {
    if (value && !/^\d*$/.test(value)) return;

    const newCreationYear = { ...filters.creationYear, [field]: value };
    setFilters({ ...filters, creationYear: newCreationYear });

    const errors = { ...yearErrors };

    if (value && !validateYear(value)) {
      errors[field] =
        `Invalid year (${VALIDATION_CONFIG.year.min}-${VALIDATION_CONFIG.year.max})`;
    } else if (
      field === "start" &&
      newCreationYear.end &&
      value &&
      parseInt(value) > parseInt(newCreationYear.end)
    ) {
      errors[field] = "Start year cannot be greater than end year";
    } else if (
      field === "end" &&
      newCreationYear.start &&
      value &&
      parseInt(value) < parseInt(newCreationYear.start)
    ) {
      errors[field] = "End year cannot be less than start year";
    } else {
      errors[field] = "";
    }

    if (
      field === "start" &&
      newCreationYear.end &&
      value &&
      parseInt(value) > parseInt(newCreationYear.end)
    ) {
      errors.end = "End year cannot be less than start year";
    } else if (
      field === "end" &&
      newCreationYear.start &&
      value &&
      parseInt(value) < parseInt(newCreationYear.start)
    ) {
      errors.start = "Start year cannot be greater than end year";
    } else if (field === "start" && newCreationYear.end) {
      errors.end = "";
    } else if (field === "end" && newCreationYear.start) {
      errors.start = "";
    }

    setYearErrors(errors);
  };

  const handleSizeChange = (field: "start" | "end", value: string) => {
    if (value && !/^\d*\.?\d*$/.test(value)) return;

    const newDatasetSize = { ...filters.datasetSize, [field]: value };
    setFilters({ ...filters, datasetSize: newDatasetSize });

    const errors = { ...sizeErrors };

    if (value && !validateSize(value)) {
      errors[field] = "Invalid size";
    } else if (
      field === "start" &&
      newDatasetSize.end &&
      value &&
      parseFloat(value) > parseFloat(newDatasetSize.end)
    ) {
      errors[field] = "Min size cannot be greater than max size";
    } else if (
      field === "end" &&
      newDatasetSize.start &&
      value &&
      parseFloat(value) < parseFloat(newDatasetSize.start)
    ) {
      errors[field] = "Max size cannot be less than min size";
    } else {
      errors[field] = "";
    }

    if (
      field === "start" &&
      newDatasetSize.end &&
      value &&
      parseFloat(value) > parseFloat(newDatasetSize.end)
    ) {
      errors.end = "Max size cannot be less than min size";
    } else if (
      field === "end" &&
      newDatasetSize.start &&
      value &&
      parseFloat(value) < parseFloat(newDatasetSize.start)
    ) {
      errors.start = "Min size cannot be greater than max size";
    } else if (field === "start" && newDatasetSize.end) {
      errors.end = "";
    } else if (field === "end" && newDatasetSize.start) {
      errors.start = "";
    }

    setSizeErrors(errors);
  };

  const handleApply = () => {
    const hasErrors =
      Object.values(yearErrors).some((error) => error) ||
      Object.values(sizeErrors).some((error) => error);

    if (hasErrors) return;

    onApplyFilters(filters);
    onClose();
  };

  const handleCancel = () => {
    setFilters(currentFilters);
    setYearErrors({ start: "", end: "" });
    setSizeErrors({ start: "", end: "" });
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log("backdrop clicked");
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleBackdropClick}
      />

      <div className="relative z-10 flex items-center justify-center transform-none w-full top-0 left-0 md:w-min md:-translate-x-1/2 md:-translate-y-1/2 md:top-1/2 md:left-1/2">
        <div
          className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col w-full max-h-[95vh] md:w-[500px] md:h-[473px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="text-H6-18-semibold text-slate-850">Filters</h2>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close filters"
            >
              <X strokeWidth={1.25} className="w-5 h-5 text-icon" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 pb-28 overscroll-contain">
            <div className="space-y-6">
              <div className="pb-6 px-6 border-b border-slate-200">
                <h4 className="text-body-16-medium mb-4 text-slate-850">
                  Access
                </h4>
                <Radio
                  name="access"
                  options={ACCESS_OPTIONS}
                  value={filters.access}
                  onChange={(value) =>
                    setFilters({ ...filters, access: value })
                  }
                />
              </div>

              <div className="pb-6 px-6 border-b border-slate-200">
                <h4 className="text-body-16-medium mb-4 text-slate-850">
                  Creation Year
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="From"
                    type="text"
                    value={filters.creationYear.start}
                    onChange={(e) => handleYearChange("start", e.target.value)}
                    placeholder="YYYY"
                    error={yearErrors.start}
                  />
                  <Input
                    label="To"
                    type="text"
                    value={filters.creationYear.end}
                    onChange={(e) => handleYearChange("end", e.target.value)}
                    placeholder="YYYY"
                    error={yearErrors.end}
                  />
                </div>
              </div>

              <div className="pb-6 px-6 border-b border-slate-200">
                <h4 className="text-body-16-medium mb-4 text-slate-850">
                  Dataset Size
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Min (MB)"
                    type="text"
                    value={filters.datasetSize.start}
                    onChange={(e) => handleSizeChange("start", e.target.value)}
                    placeholder="0"
                    error={sizeErrors.start}
                  />
                  <Input
                    label="Max (MB)"
                    type="text"
                    value={filters.datasetSize.end}
                    onChange={(e) => handleSizeChange("end", e.target.value)}
                    placeholder="∞"
                    error={sizeErrors.end}
                  />
                </div>
              </div>

              <div className="pb-6 px-6 border-b border-slate-200">
                <h4 className="text-body-16-medium mb-4 text-slate-850">
                  Field of Science
                </h4>
                {isLoadingFields ? (
                  <div className="flex justify-center items-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <HierarchicalDropdown
                    value={filters.fieldsOfScience}
                    onChange={(value) =>
                      setFilters({ ...filters, fieldsOfScience: value })
                    }
                    categories={fieldsOfScienceCategories}
                    placeholder="Search..."
                    searchPlaceholder="Search..."
                    noOptionsText="No fields of science found"
                  />
                )}
              </div>

              <div className="px-6">
                <h4 className="text-body-16-medium mb-4 text-slate-850">
                  License
                </h4>
                {isLoadingLicenses ? (
                  <div className="flex justify-center items-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <MultiSelect
                    options={licenses}
                    value={filters.license}
                    onChange={(value) =>
                      setFilters({ ...filters, license: value })
                    }
                    placeholder="Select licenses..."
                    searchable={false}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
