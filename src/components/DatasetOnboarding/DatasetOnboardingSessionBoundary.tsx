"use client";

/**
 * The client seam between the application's authenticated session and the
 * accepted, transport-free `OnboardingSessionProvider`.
 *
 * The provider deliberately takes its identity and its start operation as
 * props, so something has to obtain them from `useApi()`. That something is
 * this component and nothing else: it exists so the provider keeps no
 * dependency on auth or the network, and so `app/datasets/layout.tsx` can stay
 * a server component that adds no markup of its own.
 *
 * It renders `children` and nothing else — no shell, no wrapper element, no
 * heading, no layout.
 *
 * Three things it must **not** do, each of which would break an accepted
 * invariant:
 *
 *  - **no `key`.** Keying the provider by token, flag or route would remount it
 *    and destroy the owner mid-attempt: a same-principal token refresh would
 *    discard a pending start, and navigating add → processing would lose the
 *    accepted process reference and the reference ledger. The accepted hook
 *    already isolates by `{ principalId, gatewayOrigin }`, clearing its state
 *    on the render that changes scope, so a changed or absent principal is
 *    handled without a remount;
 *  - **no request.** Mounting this starts nothing. `useApi()` builds the
 *    binding; the provider is inert until a consumer calls `submit`. The
 *    processing route stays independent of it and of the submission flags;
 *  - **no policy.** No flag is read here, no role is inspected and no scope is
 *    reconstructed. `datasetOnboarding.scope` is `null` until the accepted
 *    binding resolves a usable principal, and `null` is what the provider is
 *    given.
 */

import type { ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import { OnboardingSessionProvider } from "./OnboardingSessionProvider";

export const DatasetOnboardingSessionBoundary = ({
  children,
}: {
  readonly children?: ReactNode;
}) => {
  const { datasetOnboarding } = useApi();

  return (
    <OnboardingSessionProvider
      identity={datasetOnboarding.scope}
      operations={datasetOnboarding.gateway}
    >
      {children}
    </OnboardingSessionProvider>
  );
};

export default DatasetOnboardingSessionBoundary;
