import type { HierarchicalCategory } from "@/components/ui/HierarchicalDropdown";

// Types for the API response
interface VocabularyItem {
  ordinal: number;
  code: string;
  name: string;
  children?: VocabularyItem[];
}

interface VocabularyResponse {
  hierarchy?: VocabularyItem[];
}

// Cache for vocabulary data
let fieldsOfScienceCache: HierarchicalCategory[] | null = null;
let licensesCache:
  | { value: string; label: string; description?: string; urls?: string[] }[]
  | null = null;

// Convert API response to HierarchicalCategory format
function convertToHierarchicalCategories(
  hierarchy: VocabularyItem[],
): HierarchicalCategory[] {
  return hierarchy
    .filter((item) => item.children && item.children.length > 0)
    .map((item) => ({
      name:
        item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase(),
      code: item.code,
      options:
        item.children?.map((childItem) => {
          return {
            value: childItem.code,
            label:
              childItem.name.charAt(0).toUpperCase() +
              childItem.name.slice(1).toLowerCase(),
            code: childItem.code,
          };
        }) || [],
    }))
    .filter((category) => category.options.length > 0);
}

export function processFieldsOfScience(
  data: VocabularyResponse | VocabularyItem[],
): HierarchicalCategory[] {
  // Return cached data if available
  if (fieldsOfScienceCache) {
    return fieldsOfScienceCache;
  }

  try {
    // Handle both formats: direct array or wrapped in hierarchy property
    const hierarchy = Array.isArray(data) ? data : data.hierarchy;

    const categories = convertToHierarchicalCategories(hierarchy ?? []);

    // Cache the result
    fieldsOfScienceCache = categories;

    return categories;
  } catch (error) {
    console.error("Error processing fields of science:", error);

    // Return empty array as fallback
    return [];
  }
}

export function processLicenses(
  data: any,
): { value: string; label: string; description?: string; urls?: string[] }[] {
  // Return cached data if available
  if (licensesCache) {
    return licensesCache;
  }

  try {
    // Transform the API response to the expected format
    // Handle different possible response formats
    let licenses: {
      value: string;
      label: string;
      description?: string;
      urls?: string[];
    }[] = [];

    if (Array.isArray(data)) {
      // Direct array format
      licenses = data.map((license: any) => ({
        value: license.code || license.value || license.id || license,
        label: license.name || license.label || license.description || license,
        description:
          typeof license.description === "string"
            ? license.description
            : undefined,
        urls: Array.isArray(license.url)
          ? license.url
          : license.url
            ? [license.url]
            : undefined,
      }));
    } else if (data && typeof data === "object") {
      // Check if it's wrapped in a property (like data.items, data.licenses, etc.)
      const possibleArrayProps = [
        "items",
        "licenses",
        "data",
        "results",
        "content",
      ];
      for (const prop of possibleArrayProps) {
        if (Array.isArray(data[prop])) {
          licenses = data[prop].map((license: any) => ({
            value: license.code || license.value || license.id || license,
            label:
              license.name || license.label || license.description || license,
            description:
              typeof license.description === "string"
                ? license.description
                : undefined,
            urls: Array.isArray(license.url)
              ? license.url
              : license.url
                ? [license.url]
                : undefined,
          }));
          break;
        }
      }

      // If still no array found, try to convert the object itself
      if (licenses.length === 0 && Object.keys(data).length > 0) {
        licenses = Object.entries(data).map(([key, value]) => ({
          value: key,
          label: typeof value === "string" ? value : key,
        }));
      }
    }

    // Cache the result
    licensesCache = licenses;

    return licenses;
  } catch (error) {
    console.error("Error fetching licenses:", error);

    // Return empty array as fallback
    return [];
  }
}

// Clear cache (useful for testing or when data needs to be refreshed)
export function clearVocabularyCache() {
  fieldsOfScienceCache = null;
  licensesCache = null;
}
