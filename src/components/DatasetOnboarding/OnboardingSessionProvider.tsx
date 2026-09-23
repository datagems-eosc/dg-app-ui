"use client";

/**
 * Dataset onboarding — one submission owner shared by the consumers of an
 * onboarding session.
 *
 * The problem this solves is ownership across a consumer change: the form and
 * the processing view are different components, and an attempt that lived in
 * either of them would be destroyed the moment the other took over — losing
 * the accepted process reference and the retained sharing intent exactly when
 * they matter. Hoisting the accepted submission hook into one context keeps a
 * single owner across that transition without a global mutable singleton and
 * without a new state library.
 *
 * It is deliberately minimal:
 *
 *  - **inert until an explicit submission.** Mounting it starts nothing. There
 *    is no effect, no read, no timer and no storage access until a consumer
 *    calls `submit`;
 *  - **no markup.** It renders its children and nothing else — no shell, no
 *    layout, no heading, no wrapper element;
 *  - **composed, never self-wiring.** `app/datasets/layout.tsx` mounts it for
 *    `/datasets/*` through `DatasetOnboardingSessionBoundary`, which is the
 *    only thing that reads the session and hands over identity and the start
 *    operation. This component still imports no transport, no auth and no
 *    flag, and it is never keyed by token, flag or route — so a same-principal
 *    token refresh and the add → processing navigation keep one owner;
 *  - **no durable session.** A remount is a new owner with an empty ledger.
 *    Deduplication holds within one mounted owner; it is not a claim about
 *    another tab, a refresh or the server.
 */

import { createContext, type ReactNode, useContext } from "react";
import {
  type DatasetOnboardingSubmissionController,
  type OnboardingStartOperations,
  type OnboardingSubmissionIdentity,
  useDatasetOnboardingSubmission,
} from "@/hooks/useDatasetOnboardingSubmission";
import type { SessionStorageLike } from "@/lib/datasetOnboarding/recovery";

const OnboardingSessionContext =
  createContext<DatasetOnboardingSubmissionController | null>(null);

export interface OnboardingSessionProviderProps {
  /** `null` while identity is unresolved. Nothing may be submitted until it resolves. */
  readonly identity: OnboardingSubmissionIdentity | null;
  /** The start operation, injected. The provider imports no transport or auth. */
  readonly operations: OnboardingStartOperations;
  /** Storage boundary; defaults to the browser session store inside the hook. */
  readonly storage?: SessionStorageLike | null;
  readonly children?: ReactNode;
}

export const OnboardingSessionProvider = ({
  identity,
  operations,
  storage,
  children,
}: OnboardingSessionProviderProps) => {
  const controller = useDatasetOnboardingSubmission({
    identity,
    operations,
    ...(storage === undefined ? {} : { storage }),
  });

  return (
    <OnboardingSessionContext.Provider value={controller}>
      {children}
    </OnboardingSessionContext.Provider>
  );
};

/**
 * The shared owner, or `null` outside a provider.
 *
 * Returning `null` rather than throwing is the useful contract for a component
 * that may legitimately render both inside and outside an onboarding session:
 * it can then disable submission instead of crashing a page.
 */
export const useOptionalOnboardingSession =
  (): DatasetOnboardingSubmissionController | null =>
    useContext(OnboardingSessionContext);

/** The shared owner. Throws when the caller genuinely requires one. */
export const useOnboardingSession =
  (): DatasetOnboardingSubmissionController => {
    const controller = useContext(OnboardingSessionContext);
    if (controller === null) {
      throw new Error(
        "useOnboardingSession must be used within an OnboardingSessionProvider",
      );
    }
    return controller;
  };
