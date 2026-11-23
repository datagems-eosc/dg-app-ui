import type { FieldOfScienceCategory } from "./fieldsOfScience";
import { logError } from "./logger";

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

// The fields-of-science vocabulary: the request in flight or settled, and
// the categories it produced once they are usable.
let fieldsOfScienceRequest: Promise<FieldOfScienceCategory[]> | null = null;
let fieldsOfScienceLoaded: FieldOfScienceCategory[] | null = null;
let licensesCache:
  | { value: string; label: string; description?: string; urls?: string[] }[]
  | null = null;

// Convert API response to FieldOfScienceCategory format
function convertToHierarchicalCategories(
  hierarchy: VocabularyItem[],
): FieldOfScienceCategory[] {
  return hierarchy
    .filter((item) => item.children && item.children.length > 0)
    .map((item) => ({
      name:
        item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase(),
      code: item.code,
      options:
        item.children?.map((childItem) => {
          return {
            // Datasets store and are searched by the vocabulary name.
            name: childItem.name,
            label:
              childItem.name.charAt(0).toUpperCase() +
              childItem.name.slice(1).toLowerCase(),
            code: childItem.code,
          };
        }) || [],
    }))
    .filter((category) => category.options.length > 0);
}

/** Converts a fields-of-science vocabulary response into dropdown categories. */
export function processFieldsOfScience(
  data: VocabularyResponse | VocabularyItem[],
): FieldOfScienceCategory[] {
  try {
    // Handle both formats: direct array or wrapped in hierarchy property
    const hierarchy = Array.isArray(data) ? data : data.hierarchy;
    return convertToHierarchicalCategories(hierarchy ?? []);
  } catch (error) {
    logError("Error processing fields of science", error);
    return [];
  }
}

/**
 * The fields-of-science vocabulary, requested once per session: every caller
 * shares one request and its result. A failed request, or one that returns no
 * usable categories, is not kept, so the next caller asks again.
 */
export function loadFieldsOfScience(
  request: () => Promise<unknown>,
): Promise<FieldOfScienceCategory[]> {
  if (!fieldsOfScienceRequest) {
    const pending = request().then((data) => {
      const categories = processFieldsOfScience(
        data as VocabularyResponse | VocabularyItem[],
      );
      // A request the cache was cleared under keeps nothing.
      if (fieldsOfScienceRequest !== pending) return categories;
      if (categories.length > 0) {
        fieldsOfScienceLoaded = categories;
      } else {
        fieldsOfScienceRequest = null;
      }
      return categories;
    });
    pending.catch(() => {
      if (fieldsOfScienceRequest === pending) fieldsOfScienceRequest = null;
    });
    fieldsOfScienceRequest = pending;
  }
  return fieldsOfScienceRequest;
}

/**
 * The vocabulary `loadFieldsOfScience` has loaded, otherwise `null`. A
 * synchronous reader must handle `null`: never fall back to sending codes.
 */
export function cachedFieldsOfScience(): FieldOfScienceCategory[] | null {
  return fieldsOfScienceLoaded;
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
    logError("Error fetching licenses", error);

    // Return empty array as fallback
    return [];
  }
}

// Clear cache (useful for testing or when data needs to be refreshed)
export function clearVocabularyCache() {
  fieldsOfScienceRequest = null;
  fieldsOfScienceLoaded = null;
  licensesCache = null;
}
