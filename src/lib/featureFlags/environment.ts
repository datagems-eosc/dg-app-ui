import type { DeploymentEnv } from "@/config/featureFlags";
import { publicEnv } from "@/lib/env";

const KNOWN_ENVS: readonly DeploymentEnv[] = [
  "playground",
  "staging",
  "production",
];

export function normalizeDeploymentEnv(
  raw: string | undefined | null,
): DeploymentEnv {
  const value = (raw ?? "").trim().toLowerCase();
  return KNOWN_ENVS.includes(value as DeploymentEnv)
    ? (value as DeploymentEnv)
    : "production";
}

export function getDeploymentEnv(): DeploymentEnv {
  return normalizeDeploymentEnv(publicEnv("DEPLOYMENT_ENV", ""));
}
