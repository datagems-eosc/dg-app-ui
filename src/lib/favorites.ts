import {
  type MappedDataset,
  mapApiDatasetToDataset,
} from "@/lib/datasetMapping";

/**
 * Shape returned by GET /api/user/settings/favorites/dataset.
 * Each favorite carries its own record `id` plus the nested `dataset`.
 */
export interface UserFavorite {
  id?: string | null;
  dataset?: ({ id?: string | null } & Record<string, unknown>) | null;
  isActive?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function extractFavoriteDatasetIds(
  favorites: UserFavorite[] | null | undefined,
): string[] {
  if (!favorites) return [];
  const ids: string[] = [];
  for (const favorite of favorites) {
    const id = favorite?.dataset?.id;
    if (typeof id === "string" && id.length > 0 && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function mapFavoritesToDatasets(
  favorites: UserFavorite[] | null | undefined,
): MappedDataset[] {
  if (!favorites) return [];
  return favorites
    .filter(
      (favorite): favorite is UserFavorite & { dataset: { id: string } } =>
        typeof favorite?.dataset?.id === "string" &&
        favorite.dataset.id.length > 0,
    )
    .map((favorite) => mapApiDatasetToDataset(favorite.dataset));
}
