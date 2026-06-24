"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import type { FeatureFlagId } from "@/config/featureFlags";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

interface FeatureFlagGuardProps {
  flag: FeatureFlagId;
  children: ReactNode;
  redirectTo?: string;
}

export function FeatureFlagGuard({
  flag,
  children,
  redirectTo = APP_ROUTES.DASHBOARD,
}: FeatureFlagGuardProps) {
  const { flags, isHydrated } = useFeatureFlags();
  const router = useRouter();
  const enabled = flags[flag];

  useEffect(() => {
    if (isHydrated && !enabled) {
      router.replace(redirectTo);
    }
  }, [isHydrated, enabled, redirectTo, router]);

  if (!enabled) return null;
  return <>{children}</>;
}
