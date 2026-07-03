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
import {
  type DatasetIdOverrides,
  readDatasetOverrides,
  writeDatasetOverrides,
} from "@/lib/featureFlags/datasetOverrides";
import { getDeploymentEnv } from "@/lib/featureFlags/environment";
import {
  type FeatureFlagOverrides,
  resolveAllDatasetIds,
  resolveAllFlags,
} from "@/lib/featureFlags/resolve";
import { readOverrides, writeOverrides } from "@/lib/featureFlags/storage";

interface FeatureFlagsContextValue {
  environment: DeploymentEnv;
  flags: Record<FeatureFlagId, boolean>;
  overrides: FeatureFlagOverrides;
  isHydrated: boolean;
  setOverride: (id: FeatureFlagId, value: boolean) => void;
  datasetIds: Partial<Record<FeatureFlagId, string | null>>;
  datasetIdOverrides: DatasetIdOverrides;
  setDatasetOverride: (id: FeatureFlagId, value: string) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(
  undefined,
);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const environment = useMemo(() => getDeploymentEnv(), []);
  const [overrides, setOverrides] = useState<FeatureFlagOverrides>({});
  const [datasetIdOverrides, setDatasetIdOverrides] =
    useState<DatasetIdOverrides>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setOverrides(readOverrides());
    setDatasetIdOverrides(readDatasetOverrides());
    setIsHydrated(true);
  }, []);

  const setOverride = useCallback((id: FeatureFlagId, value: boolean) => {
    setOverrides((previous) => {
      const next = { ...previous, [id]: value };
      writeOverrides(next);
      return next;
    });
  }, []);

  const setDatasetOverride = useCallback((id: FeatureFlagId, value: string) => {
    setDatasetIdOverrides((previous) => {
      const next = { ...previous };
      if (value.trim()) {
        next[id] = value.trim();
      } else {
        delete next[id];
      }
      writeDatasetOverrides(next);
      return next;
    });
  }, []);

  const flags = useMemo(
    () => resolveAllFlags(environment, overrides),
    [environment, overrides],
  );

  const datasetIds = useMemo(
    () => resolveAllDatasetIds(environment, datasetIdOverrides),
    [environment, datasetIdOverrides],
  );

  const value = useMemo(
    () => ({
      environment,
      flags,
      overrides,
      isHydrated,
      setOverride,
      datasetIds,
      datasetIdOverrides,
      setDatasetOverride,
    }),
    [
      environment,
      flags,
      overrides,
      isHydrated,
      setOverride,
      datasetIds,
      datasetIdOverrides,
      setDatasetOverride,
    ],
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
