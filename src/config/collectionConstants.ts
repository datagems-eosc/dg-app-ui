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
      return (
        !CUSTOM_COLLECTION_PATTERN.test(name) &&
        getDisplayCollectionName(col).trim() !== ""
      );
    })
    .slice(0, maxCount);
}

export function getDisplayCollectionName(col: DisplayCollection): string {
  const name = typeof col.name === "string" ? col.name : "";
  return name.replace(/ Collection$/i, "");
}

/**
 * First displayable collection name, or "" when none is available. Never
 * substitutes an internal category: that would present a fabricated
 * collection membership (#251).
 */
export function getDisplayCollectionLabel(
  collections: DisplayCollection[] | undefined,
): string {
  const [first] = getDisplayCollections(collections ?? [], 1);
  return first ? getDisplayCollectionName(first) : "";
}
