/**
 * Shared layout for `/datasets/*`.
 *
 * Its only job is to place one onboarding submission owner above both the add
 * form and the processing page, so an attempt survives the navigation between
 * them. It adds no shell, no markup and no styling — the pages keep their own
 * `DashboardLayout` — and it starts no request: the boundary below is inert
 * until a consumer submits.
 *
 * This file stays a server component; the client seam is
 * `DatasetOnboardingSessionBoundary`, which is the only thing here that needs
 * the session.
 */

import { DatasetOnboardingSessionBoundary } from "@/components/DatasetOnboarding/DatasetOnboardingSessionBoundary";

export default function DatasetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DatasetOnboardingSessionBoundary>
      {children}
    </DatasetOnboardingSessionBoundary>
  );
}
