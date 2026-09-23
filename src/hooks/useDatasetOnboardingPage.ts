"use client";

/**
 * Dataset onboarding — page composition.
 *
 * Derived state, not a second state machine. It wires three accepted pieces
 * together in the one order that has no cycle in it:
 *
 *   1. the route controller reads the process (it must not depend on access);
 *   2. the availability hook reads the dataset the controller reported;
 *   3. the **pure** `buildOnboardingView` derives what to show from both.
 *
 * Feeding access evidence into the route controller instead would be circular:
 * the dataset id and the completion that make an availability read meaningful
 * are outputs of that very controller.
 *
 * Nothing here polls, fetches, stores or decides policy. Every status, stage
 * order and permitted action still comes from the accepted model.
 */

import { useCallback, useMemo } from "react";
import type { ProcessingReadState } from "@/components/DatasetOnboarding/presentation";
import { buildOnboardingView } from "@/lib/datasetOnboarding/model";
import type {
  AccessEvidence,
  DatasetId,
  OnboardingView,
} from "@/lib/datasetOnboarding/types";
import { type OnboardingAuthAvailability, useApi } from "./useApi";
import {
  type AccessTiming,
  type OnboardingAccessScope,
  useDatasetOnboardingAccess,
} from "./useDatasetOnboardingAccess";
import {
  type DatasetOnboardingRouteController,
  useDatasetOnboardingRoute,
} from "./useDatasetOnboardingRoute";

export interface UseDatasetOnboardingPageInput {
  /** The route parameter exactly as Next supplies it, already decoded. */
  readonly processInstanceIdParam:
    | string
    | readonly string[]
    | undefined
    | null;
  readonly accessTiming?: Partial<AccessTiming>;
}

export interface DatasetOnboardingPageState {
  /** The view model, derived with the access evidence this page obtained. */
  readonly view: OnboardingView;
  /** Only ever the name from a matching successful read. */
  readonly datasetTitle?: string;
  readonly read: ProcessingReadState;
  readonly sharingNeedsReconciliation: boolean;
  /** Rechecks the process status and, when in scope, dataset access. */
  readonly checkAgain: () => void;
  readonly retryConfiguration: () => void;
  /** Exposed for tests and for the page's focus key. */
  readonly controller: DatasetOnboardingRouteController;
}

/**
 * A session that is still resolving is *not* a verdict. Reporting "sign in
 * again" while NextAuth is loading would tell the user to fix something that is
 * not broken, so only a settled, unusable identity counts as unavailable.
 */
const sessionUsability = (
  auth: OnboardingAuthAvailability,
): "available" | "unavailable" =>
  auth === "loading" || auth === "available" ? "available" : "unavailable";

export const useDatasetOnboardingPage = ({
  processInstanceIdParam,
  accessTiming,
}: UseDatasetOnboardingPageInput): DatasetOnboardingPageState => {
  // The accepted controller, unchanged and deliberately without access
  // evidence: supplying it here is what would close the cycle.
  const controller = useDatasetOnboardingRoute({ processInstanceIdParam });

  // A second `useApi()` call for the additive reader. It is not a second
  // poller and holds no state; the binding it returns is memoised.
  const { datasetOnboarding } = useApi();
  const readDataset = datasetOnboarding.readDataset;

  const principalId = controller.scope?.principalId ?? null;
  const gatewayOrigin = controller.scope?.gatewayOrigin ?? null;
  const processInstanceId = controller.processInstanceId;
  // The id the process itself reported. Never a stored one, never a search.
  const datasetId = controller.snapshot?.datasetId ?? null;

  const accessScope = useMemo<OnboardingAccessScope | null>(
    () =>
      principalId === null ||
      gatewayOrigin === null ||
      processInstanceId === null ||
      datasetId === undefined ||
      datasetId === null
        ? null
        : { principalId, gatewayOrigin, processInstanceId, datasetId },
    [principalId, gatewayOrigin, processInstanceId, datasetId],
  );

  // Automatic checking waits for a reported completion. An inconsistent
  // display is not one: the process contradicted itself, and confirming
  // metadata would dress that up as a finished run.
  const automatic = controller.view.processing === "succeeded";

  const access = useDatasetOnboardingAccess({
    scope: accessScope,
    readDataset,
    automatic,
    ...(accessTiming === undefined ? {} : { timing: accessTiming }),
  });

  // Revision 5: onboarding requests no sharing, so the default context is
  // "nothing was asked for" rather than "something was asked for and never
  // confirmed". The only thing that upgrades it is an explicit earlier
  // recovery record for *this* scope and *this* process, which the accepted
  // controller already matches by principal, environment and process id.
  //
  // Neither value is access evidence. `not-requested` says only that this flow
  // issued no grant; it never claims the dataset is private, public or visible
  // to anyone. `dmmReady` remains deliberately un-inferred from a metadata
  // read.
  const earlierSharingUnconfirmed = controller.sharingNeedsReconciliation;
  const accessEvidence = useMemo<AccessEvidence>(
    () => ({
      availability: access.availability,
      sharing: earlierSharingUnconfirmed ? "not-confirmed" : "not-requested",
    }),
    [access.availability, earlierSharingUnconfirmed],
  );

  const view = useMemo(
    () =>
      buildOnboardingView({
        snapshot: controller.snapshot,
        config: controller.config,
        access: accessEvidence,
        connection: controller.connection,
      }),
    [
      controller.snapshot,
      controller.config,
      accessEvidence,
      controller.connection,
    ],
  );

  const read = useMemo<ProcessingReadState>(
    () => ({
      phase: controller.phase,
      failure: controller.lastFailure,
      reference: controller.reference,
      session: sessionUsability(controller.auth),
    }),
    [
      controller.phase,
      controller.lastFailure,
      controller.reference,
      controller.auth,
    ],
  );

  const controllerCheckAgain = controller.checkAgain;
  const accessCheckNow = access.checkNow;
  const checkAgain = useCallback(() => {
    // Two independent read-only operations, not one chained request. The
    // availability call is inert whenever there is no dataset scope yet.
    controllerCheckAgain();
    accessCheckNow();
  }, [controllerCheckAgain, accessCheckNow]);

  return {
    view,
    ...(access.datasetName === undefined
      ? {}
      : { datasetTitle: access.datasetName }),
    read,
    sharingNeedsReconciliation: earlierSharingUnconfirmed,
    checkAgain,
    retryConfiguration: controller.retryConfiguration,
    controller,
  };
};

export type { DatasetId };
