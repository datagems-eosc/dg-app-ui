import { mbToBytes } from "@/lib/utils";
import { fetchFieldsOfScience, fetchLicenses } from "@/lib/vocabularyService";

export const ACCESS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "restricted", label: "Restricted" },
];

// Sorting options for the dropdown
export const SORTING_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "datePublished-asc", label: "Date Published (oldest first)" },
  { value: "datePublished-desc", label: "Date Published (newest first)" },
  { value: "size-asc", label: "Size (smallest first)" },
  { value: "size-desc", label: "Size (highest first)" },
];

// Unified filter interface for both frontend and backend
export interface UnifiedFilterState {
  access?: "open" | "restricted" | "";
  publishedRange?: { start: string; end: string };
  sizeRange?: { start?: number; end?: number };
  fieldsOfScience?: string[];
  license?: string[];
  mimeType?: string[];
}

// Legacy interface for backward compatibility
export interface FilterState {
  access: string;
  creationYear: { start: string; end: string };
  datasetSize: { start: string; end: string };
  fieldsOfScience: string[];
  license: string[];
}

export const getDefaultFilters = (): FilterState => ({
  access: "",
  creationYear: { start: "", end: "" },
  datasetSize: { start: "", end: "" },
  fieldsOfScience: [],
  license: [],
});

// Convert FilterState to UnifiedFilterState for backend
export const convertToBackendFilters = (
  filters: FilterState
): UnifiedFilterState => {
  // Convert year to date format (YYYY-01-01 for start, YYYY-12-31 for end)
  const convertYearToDate = (year: string, isEnd: boolean = false) => {
    if (!year) return "";
    const date = new Date(parseInt(year), isEnd ? 11 : 0, isEnd ? 31 : 1);
    return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
  };

  return {
    access:
      filters.access === "open" || filters.access === "restricted"
        ? filters.access
        : undefined,
    publishedRange: (() => {
      const startYear = filters.creationYear.start;
      const endYear = filters.creationYear.end;

      // Only include publishedRange if both years are provided
      if (startYear && endYear) {
        return {
          start: convertYearToDate(startYear, false),
          end: convertYearToDate(endYear, true),
        };
      }
      return undefined;
    })(),
    sizeRange: (() => {
      const startMB = filters.datasetSize.start
        ? parseFloat(filters.datasetSize.start)
        : 0;
      const endMB = filters.datasetSize.end
        ? parseFloat(filters.datasetSize.end)
        : 0;

      // Only include sizeRange if at least one value is provided and greater than 0
      if (startMB > 0 || endMB > 0) {
        return {
          start: startMB > 0 ? mbToBytes(startMB) : undefined,
          end: endMB > 0 ? mbToBytes(endMB) : undefined,
        };
      }
      return undefined;
    })(),
    fieldsOfScience:
      filters.fieldsOfScience.length > 0 ? filters.fieldsOfScience : undefined,
    license: filters.license.length > 0 ? filters.license : undefined,
  };
};

// Validation constants
export const VALIDATION_CONFIG = {
  year: {
    min: 1900,
    max: new Date().getFullYear(),
  },
  size: {
    min: 0,
  },
} as const;

// Export both fetch functions
export { fetchFieldsOfScience, fetchLicenses };
