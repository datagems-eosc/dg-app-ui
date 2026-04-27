export const COLLECTION_NAMES = {
  FAVORITES: "Favorites",
  FAVORITES_DATASETS: "Favorites Datasets",
} as const;

export const COLLECTION_GRANTS = {
  DELETE: "dg_col-delete",
} as const;

export const DELETE_COLLECTION_DELAY_MS = 500;

export const MAX_DISPLAY_COLLECTIONS = 5;

const CUSTOM_COLLECTION_PATTERN = /custom/i;

export type DisplayCollection = { id?: string; name: string };

export function getDisplayCollections(
  collections: DisplayCollection[],
  maxCount = MAX_DISPLAY_COLLECTIONS,
): DisplayCollection[] {
  return collections
    .filter((col) => {
      const name = typeof col.name === "string" ? col.name : "";
      return !CUSTOM_COLLECTION_PATTERN.test(name);
    })
    .slice(0, maxCount);
}

export function getDisplayCollectionName(col: DisplayCollection): string {
  const name = typeof col.name === "string" ? col.name : "";
  return name.replace(/ Collection$/i, "");
}

export function getDisplayCategory(
  collections: DisplayCollection[] | undefined,
  fallbackCategory: string,
): string {
  if (!collections?.length) return fallbackCategory;
  const display = getDisplayCollections(collections, 1);
  return display.length > 0
    ? getDisplayCollectionName(display[0])
    : fallbackCategory;
}
