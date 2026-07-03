import {
  type DeploymentEnv,
  FEATURE_FLAGS,
  type FeatureFlagId,
  getFeatureFlagDefinition,
} from "@/config/featureFlags";
import type { DatasetIdOverrides } from "@/lib/featureFlags/datasetOverrides";

export type FeatureFlagOverrides = Partial<Record<FeatureFlagId, boolean>>;

export function resolveFlag(
  flagId: FeatureFlagId,
  env: DeploymentEnv,
  overrides: FeatureFlagOverrides,
): boolean {
  const override = overrides[flagId];
  if (typeof override === "boolean") return override;
  const definition = getFeatureFlagDefinition(flagId);
  return definition ? definition.defaults[env] : false;
}

export function resolveAllFlags(
  env: DeploymentEnv,
  overrides: FeatureFlagOverrides,
): Record<FeatureFlagId, boolean> {
  const resolved = {} as Record<FeatureFlagId, boolean>;
  for (const definition of FEATURE_FLAGS) {
    resolved[definition.id] = resolveFlag(definition.id, env, overrides);
  }
  return resolved;
}

export function resolveDatasetId(
  flagId: FeatureFlagId,
  env: DeploymentEnv,
  overrides: DatasetIdOverrides,
): string | null {
  const override = overrides[flagId];
  if (typeof override === "string" && override.trim() !== "") return override;
  const definition = getFeatureFlagDefinition(flagId);
  return definition?.defaultDatasetId?.[env] ?? null;
}

export function resolveAllDatasetIds(
  env: DeploymentEnv,
  overrides: DatasetIdOverrides,
): Partial<Record<FeatureFlagId, string | null>> {
  const resolved: Partial<Record<FeatureFlagId, string | null>> = {};
  for (const definition of FEATURE_FLAGS) {
    if (definition.defaultDatasetId !== undefined) {
      resolved[definition.id] = resolveDatasetId(definition.id, env, overrides);
    }
  }
  return resolved;
}
