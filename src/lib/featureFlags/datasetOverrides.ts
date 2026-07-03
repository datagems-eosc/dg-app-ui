import { FEATURE_FLAG_IDS, type FeatureFlagId } from "@/config/featureFlags";
import { isBrowser } from "@/lib/env";
import { logError } from "@/lib/logger";

export const DATASET_OVERRIDES_STORAGE_KEY = "datagemsDatasetOverrides";

export type DatasetIdOverrides = Partial<Record<FeatureFlagId, string>>;

const KNOWN_IDS = new Set<string>(FEATURE_FLAG_IDS);

export function parseDatasetOverrides(raw: string | null): DatasetIdOverrides {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const overrides: DatasetIdOverrides = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (KNOWN_IDS.has(key) && typeof value === "string") {
      overrides[key as FeatureFlagId] = value;
    }
  }
  return overrides;
}

export function readDatasetOverrides(): DatasetIdOverrides {
  if (!isBrowser()) return {};
  try {
    return parseDatasetOverrides(
      window.localStorage.getItem(DATASET_OVERRIDES_STORAGE_KEY),
    );
  } catch (error) {
    logError("Failed to read dataset overrides from storage", error);
    return {};
  }
}

export function writeDatasetOverrides(overrides: DatasetIdOverrides): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      DATASET_OVERRIDES_STORAGE_KEY,
      JSON.stringify(overrides),
    );
  } catch (error) {
    logError("Failed to persist dataset overrides to storage", error);
  }
}
