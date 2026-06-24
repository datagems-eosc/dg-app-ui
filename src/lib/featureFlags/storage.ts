import { FEATURE_FLAG_IDS, type FeatureFlagId } from "@/config/featureFlags";
import { isBrowser } from "@/lib/env";
import type { FeatureFlagOverrides } from "@/lib/featureFlags/resolve";
import { logError } from "@/lib/logger";

export const FEATURE_FLAGS_STORAGE_KEY = "datagemsFeatureFlags";

const KNOWN_IDS = new Set<string>(FEATURE_FLAG_IDS);

export function parseOverrides(raw: string | null): FeatureFlagOverrides {
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

  const overrides: FeatureFlagOverrides = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (KNOWN_IDS.has(key) && typeof value === "boolean") {
      overrides[key as FeatureFlagId] = value;
    }
  }
  return overrides;
}

export function readOverrides(): FeatureFlagOverrides {
  if (!isBrowser()) return {};
  try {
    return parseOverrides(
      window.localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY),
    );
  } catch (error) {
    logError("Failed to read feature flag overrides from storage", error);
    return {};
  }
}

export function writeOverrides(overrides: FeatureFlagOverrides): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify(overrides),
    );
  } catch (error) {
    logError("Failed to persist feature flag overrides to storage", error);
  }
}
