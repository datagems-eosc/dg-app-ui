"use client";

/**
 * Dataset onboarding — headless controller for
 * `/datasets/onboarding/[processInstanceId]`.
 *
 * This is the composition layer and nothing else. It owns no JSX, no router
 * redirect, no start and no grant: it resolves *which* scope and *which*
 * process a mounted view is allowed to monitor, and hands the accepted
 * monitoring hook the identity and operations it needs. Task 5.3 creates the
 * public page and mounts it with the accepted processing view; nothing here
 * renders.
 *
 * Three composed parts, all already accepted and reused unchanged:
 *
 *  - `useApi().datasetOnboarding` — the session/environment binding and the
 *    Gateway adapter over the existing authenticated transport (task 4.3);
 *  - `useDatasetOnboardingProcess` — read cadence, cancellation and scope
 *    isolation (task 4.1);
 *  - `lib/datasetOnboarding/recovery` — the same-tab reference (task 4.2).
 *
 * Deliberately absent, and not an oversight:
 *
 *  - no mutation of any kind. The only storage write this controller can make
 *    is a best-effort *removal* on an explicit signed-out session; writing the
 *    accepted-start reference belongs to submission ownership in group 6;
 *  - no fallback from an invalid URL to a stored process. A route parameter is
 *    a lookup reference, and a stored one cannot stand in for it;
 *  - no second poller, no dataset-readability probe, no sharing policy.
 */

import { useEffect, useMemo, useState } from "react";
import {
  clearSessionRecord,
  getBrowserSessionStorage,
  readSessionRecord,
  type SessionStorageLike,
} from "@/lib/datasetOnboarding/recovery";
import {
  type AccessEvidence,
  asProcessInstanceId,
  type ConnectionState,
  type GatewayFailure,
  type OnboardingConfig,
  type OnboardingView,
  type ProcessInstanceId,
  type ProcessSnapshot,
} from "@/lib/datasetOnboarding/types";
import {
  type OnboardingAuthAvailability,
  type OnboardingScope,
  useApi,
} from "./useApi";
import {
  type MonitoringPhase,
  type MonitoringStopReason,
  type MonitoringTiming,
  useDatasetOnboardingProcess,
} from "./useDatasetOnboardingProcess";

// ---------------------------------------------------------------------------
// Route reference
// ---------------------------------------------------------------------------

/**
 * Control characters cannot appear in a legitimate identifier and would travel
 * into a request path. Everything else is left alone: the adapter accepts any
 * non-empty id, so imposing a UUID shape here would reject references the
 * Gateway itself would answer.
 *
 * Written as a scan rather than a character-class regex so the control
 * characters being *looked for* are not control characters in this source.
 */
const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

/**
 * Reads the route parameter as a process reference, or `null` if it cannot be
 * one.
 *
 * The value arrives **already decoded** by Next; decoding it again would
 * corrupt any id containing a literal `%`. The accepted adapter encodes it for
 * the request, so it is passed on verbatim — a reference is not rewritten to
 * make it look valid.
 *
 * An array (a repeated or catch-all segment) is refused rather than having its
 * first element picked: that would be guessing which process was meant.
 */
export const readRouteProcessInstanceId = (
  parameter: string | readonly string[] | undefined | null,
): ProcessInstanceId | null => {
  if (typeof parameter !== "string") return null;
  if (parameter.trim() === "") return null;
  if (hasControlCharacter(parameter)) return null;
  return asProcessInstanceId(parameter);
};

// ---------------------------------------------------------------------------
// Inputs and outputs
// ---------------------------------------------------------------------------

export interface UseDatasetOnboardingRouteInput {
  /** The route parameter exactly as Next supplies it, already decoded. */
  readonly processInstanceIdParam:
    | string
    | readonly string[]
    | undefined
    | null;
  /** Access evidence established elsewhere; never derived here. */
  readonly access?: AccessEvidence;
  readonly timing?: Partial<MonitoringTiming>;
  /**
   * Storage boundary. Defaults to the browser session store; injected by tests
   * so an unavailable or throwing store is a first-class case.
   */
  readonly storage?: SessionStorageLike | null;
}

export type OnboardingRouteStatus =
  /** No usable session identity: nothing is read and nothing is shown. */
  | "auth-unavailable"
  /** The URL carries no usable process reference. */
  | "invalid-reference"
  | "monitoring";

export interface DatasetOnboardingRouteController {
  readonly status: OnboardingRouteStatus;
  /** Why authentication is unusable, when it is. */
  readonly auth: OnboardingAuthAvailability;
  readonly reference: "valid" | "invalid";
  /** Resolved scope, or `null`. Carries no token. */
  readonly scope: OnboardingScope | null;
  readonly processInstanceId: ProcessInstanceId | null;
  readonly view: OnboardingView;
  readonly snapshot: ProcessSnapshot | null;
  readonly config: OnboardingConfig | null;
  readonly configurationUnavailable: boolean;
  readonly connection: ConnectionState;
  readonly phase: MonitoringPhase;
  readonly stopReason?: MonitoringStopReason;
  readonly lastFailure: GatewayFailure | null;
  /**
   * A reference for *this* process, written by this principal in this
   * environment, recorded that its sharing intent was never reconciled. It is
   * a reminder to re-establish access, never evidence that a grant was applied
   * and never permission to replay one. `false` also covers "no record".
   */
  readonly sharingNeedsReconciliation: boolean;
  /** Read-only. Never a mutation, rerun, cancellation or stage start. */
  readonly checkAgain: () => void;
  readonly retryConfiguration: () => void;
}

// ---------------------------------------------------------------------------
// Scope key
// ---------------------------------------------------------------------------

const INACTIVE_SCOPE = "\u0000inactive";

/** NUL-separated, as in the monitoring hook, so no value can forge a key. */
const routeScopeKeyOf = (
  scope: OnboardingScope | null,
  processInstanceId: ProcessInstanceId | null,
): string =>
  scope === null || processInstanceId === null
    ? INACTIVE_SCOPE
    : `${scope.principalId}\u0000${scope.gatewayOrigin}\u0000${processInstanceId}`;

interface RecoveryMarker {
  /** Which scope this marker was read for. Another scope's is never shown. */
  readonly scopeKey: string;
  readonly sharingNeedsReconciliation: boolean;
}

const NO_MARKER: RecoveryMarker = {
  scopeKey: INACTIVE_SCOPE,
  sharingNeedsReconciliation: false,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDatasetOnboardingRoute = ({
  processInstanceIdParam,
  access,
  timing,
  storage: providedStorage,
}: UseDatasetOnboardingRouteInput): DatasetOnboardingRouteController => {
  const { datasetOnboarding } = useApi();
  const { auth, scope, gateway } = datasetOnboarding;

  const processInstanceId = useMemo(
    () => readRouteProcessInstanceId(processInstanceIdParam),
    [processInstanceIdParam],
  );

  const storage = useMemo(
    () =>
      providedStorage === undefined
        ? getBrowserSessionStorage()
        : providedStorage,
    [providedStorage],
  );

  // The monitoring hook receives `null` for either half whenever the scope is
  // incomplete, so an unusable session or an unusable URL means no read at all
  // — and, because that hook clears on the render that changes scope, no
  // previously rendered snapshot survives the transition either.
  const monitor = useDatasetOnboardingProcess({
    identity: scope,
    processInstanceId,
    operations: gateway,
    ...(access === undefined ? {} : { access }),
    ...(timing === undefined ? {} : { timing }),
  });

  const scopeKey = routeScopeKeyOf(scope, processInstanceId);
  const [marker, setMarker] = useState<RecoveryMarker>(NO_MARKER);

  const principalId = scope?.principalId ?? null;
  const gatewayOrigin = scope?.gatewayOrigin ?? null;

  useEffect(() => {
    if (
      principalId === null ||
      gatewayOrigin === null ||
      processInstanceId === null
    ) {
      return;
    }

    // Storage is read, never written, and never gates the read above: a direct
    // URL works with no record at all, and a failing store costs a notice, not
    // monitoring. A record from another principal or environment is reported
    // as foreign by the accepted helper and its contents are not touched here.
    const outcome = readSessionRecord(storage, {
      principalId,
      gatewayOrigin,
    });

    const matchesThisProcess =
      outcome.kind === "restored" &&
      outcome.record.processInstanceId === processInstanceId;

    setMarker({
      scopeKey: routeScopeKeyOf(
        { principalId, gatewayOrigin },
        processInstanceId,
      ),
      sharingNeedsReconciliation:
        matchesThisProcess && outcome.record.sharingNeedsReconciliation,
    });
  }, [principalId, gatewayOrigin, processInstanceId, storage]);

  useEffect(() => {
    // Only an explicit signed-out session clears the reference. Loading and a
    // temporary session error are not a sign-out, and destroying the reference
    // on either would lose a running process the user can still return to.
    //
    // This is cleanup by a mounted controller, not proof that sign-out is
    // covered everywhere: the full application lifecycle is group 6 and final
    // integration work.
    if (auth !== "unauthenticated") return;
    clearSessionRecord(storage);
  }, [auth, storage]);

  const status: OnboardingRouteStatus =
    scope === null
      ? "auth-unavailable"
      : processInstanceId === null
        ? "invalid-reference"
        : "monitoring";

  return {
    status,
    auth,
    reference: processInstanceId === null ? "invalid" : "valid",
    scope,
    processInstanceId,
    view: monitor.view,
    snapshot: monitor.snapshot,
    config: monitor.config,
    configurationUnavailable: monitor.configurationUnavailable,
    connection: monitor.connection,
    phase: monitor.phase,
    ...(monitor.stopReason === undefined
      ? {}
      : { stopReason: monitor.stopReason }),
    lastFailure: monitor.lastFailure,
    // Compared rather than cleared: a marker read for an earlier scope is
    // simply not this scope's marker, so it can never be shown against another
    // principal's, environment's or process's monitoring.
    sharingNeedsReconciliation:
      marker.scopeKey === scopeKey && marker.scopeKey !== INACTIVE_SCOPE
        ? marker.sharingNeedsReconciliation
        : false,
    checkAgain: monitor.checkAgain,
    retryConfiguration: monitor.retryConfiguration,
  };
};
