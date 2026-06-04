"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DeploymentEnv, FeatureFlagId } from "@/config/featureFlags";
import { getDeploymentEnv } from "@/lib/featureFlags/environment";
import {
  type FeatureFlagOverrides,
  resolveAllFlags,
} from "@/lib/featureFlags/resolve";
import { readOverrides, writeOverrides } from "@/lib/featureFlags/storage";

interface FeatureFlagsContextValue {
  environment: DeploymentEnv;
  flags: Record<FeatureFlagId, boolean>;
  overrides: FeatureFlagOverrides;
  isHydrated: boolean;
  setOverride: (id: FeatureFlagId, value: boolean) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(
  undefined,
);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const environment = useMemo(() => getDeploymentEnv(), []);
  const [overrides, setOverrides] = useState<FeatureFlagOverrides>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setOverrides(readOverrides());
    setIsHydrated(true);
  }, []);

  const setOverride = useCallback((id: FeatureFlagId, value: boolean) => {
    setOverrides((previous) => {
      const next = { ...previous, [id]: value };
      writeOverrides(next);
      return next;
    });
  }, []);

  const flags = useMemo(
    () => resolveAllFlags(environment, overrides),
    [environment, overrides],
  );

  const value = useMemo(
    () => ({ environment, flags, overrides, isHydrated, setOverride }),
    [environment, flags, overrides, isHydrated, setOverride],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    );
  }
  return context;
}

export function useFeatureFlag(id: FeatureFlagId): boolean {
  return useFeatureFlags().flags[id];
}
