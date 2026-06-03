import {
  type DeploymentEnv,
  FEATURE_FLAGS,
  type FeatureFlagId,
  getFeatureFlagDefinition,
} from "@/config/featureFlags";

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
