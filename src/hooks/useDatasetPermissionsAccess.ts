"use client";

/**
 * Dataset permissions — the read side, for one dataset, for one owner.
 *
 * `useDatasetPermissions` owns what may be *written*. This hook owns what is
 * *known*, which is the half PM-02A deliberately left out: capability
 * evidence, group discovery, recipient grants, and the presentation those
 * jointly support. It is the feature's single composition owner — there is no
 * second state machine here, and every decision is delegated:
 * `model.decideAction` decides capabilities, `model.describeEveryoneDiscovery`
 * decides the public audience, and `mode.selectAccessMode` decides the
 * presentation. What this hook adds is the part none of them can own: *when* a
 * read may start, and whose answer it is when it lands.
 *
 * The gateway is injected, so nothing here depends on `useApi`, auth or the
 * network; `useApi().datasetPermissions.gateway` supplies the real one.
 *
 * Ownership, the same rule as the write side and for the same reason:
 *
 *  - every read is issued under a **generation**, bumped on effect start and
 *    teardown, and its result is dropped unless the generation still matches.
 *    A textually identical A → unavailable → A is a new generation, so the
 *    first A's answers can never land in the second A's view;
 *  - reads are **cancelled** on scope change and unmount through one
 *    `AbortController` per generation. Unlike a mutation, abandoning a read is
 *    free: it tells us nothing and changes nothing on the server;
 *  - the **gateway is held in a ref**. A same-principal token refresh hands
 *    over a new gateway object for the same account, and that must not restart
 *    reads or discard what they found. Only `(principalId, gatewayOrigin,
 *    datasetId)` restarts anything.
 *
 * Two rules about what is *not* read:
 *
 *  - recipient grants are not fetched at all when the caller's complete global
 *    evidence says lookup is not permitted. Asking anyway would spend a refusal
 *    per group to learn something already known;
 *  - a recipient read is fetched per group, because the Gateway has no route
 *    that returns every group holding a role on a dataset. Partial success is
 *    not knowledge: if any group's read does not complete, the recipient state
 *    is `failed`, never a shorter list presented as the whole answer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DatasetPermissionsGateway } from "@/lib/datasetPermissions/gateway";
import {
  type AccessCapabilities,
  type DatasetAccessMode,
  selectAccessMode,
  UNKNOWN_CAPABILITIES,
} from "@/lib/datasetPermissions/mode";
import {
  type ActionEvidence,
  decideAction,
  describeEveryoneDiscovery,
  PERMISSIONS_NOT_READ,
} from "@/lib/datasetPermissions/model";
import type {
  EveryoneDiscovery,
  GroupDiscoveryState,
  RecipientGrantsState,
  UserGroupRef,
} from "@/lib/datasetPermissions/types";

export interface DatasetAccessScope {
  readonly principalId: string;
  readonly gatewayOrigin: string;
  readonly datasetId: string;
}

export interface UseDatasetPermissionsAccessInput {
  /** `null` while identity or dataset is unresolved. Nothing is read. */
  readonly scope: DatasetAccessScope | null;
  readonly gateway: DatasetPermissionsGateway;
  /**
   * `false` keeps the hook inert: no request is issued and nothing is
   * remembered. The rollout flag is the only caller of this today, and this is
   * what "the new flow issues no requests when it is off" is enforced by, in
   * addition to the entry points not mounting it.
   */
  readonly enabled?: boolean;
}

export interface DatasetAccessReadState {
  /** `true` until every read this owner needs has settled. */
  readonly loading: boolean;
  readonly groups: GroupDiscoveryState;
  readonly recipients: RecipientGrantsState;
  readonly everyone: EveryoneDiscovery;
  readonly capabilities: AccessCapabilities;
  readonly mode: DatasetAccessMode;
  /**
   * `true` when a reconciliation read after an acknowledged write did not
   * complete. It never downgrades what is already known — the previous
   * recipient state is kept — so the view can say "we could not re-check"
   * without any row moving.
   */
  readonly reconciliationFailed: boolean;
  /**
   * Re-read one group's grants after an acknowledged change to it. Supported
   * only where recipient lookup is; a no-op otherwise. It refreshes the
   * baseline and never rolls an acknowledged operation back: `rows.ts` keeps
   * acknowledged operations winning over the baseline precisely so a lagging
   * read cannot un-apply something the Gateway confirmed.
   */
  readonly reconcileGroup: (groupId: string) => void;
}

const NOT_READ_RECIPIENTS: RecipientGrantsState = {
  kind: "unknown",
  reason: "not-read",
};
const RESTRICTED_RECIPIENTS: RecipientGrantsState = {
  kind: "unknown",
  reason: "not-supported",
};
const UNKNOWN_GROUPS: GroupDiscoveryState = { kind: "unknown" };

const INACTIVE_SCOPE = "\u0000inactive";

/** NUL-separated so no component value can forge another scope's key. */
const scopeKeyOf = (scope: DatasetAccessScope | null): string => {
  if (scope === null) return INACTIVE_SCOPE;
  const { principalId, gatewayOrigin, datasetId } = scope;
  if (
    principalId.trim() === "" ||
    gatewayOrigin.trim() === "" ||
    datasetId.trim() === ""
  ) {
    return INACTIVE_SCOPE;
  }
  return `${principalId}\u0000${gatewayOrigin}\u0000${datasetId}`;
};

interface ReadState {
  readonly scopeKey: string;
  readonly loading: boolean;
  readonly groups: GroupDiscoveryState;
  readonly recipients: RecipientGrantsState;
  readonly capabilities: AccessCapabilities;
  readonly reconciliationFailed: boolean;
}

const idleState = (scopeKey: string): ReadState => ({
  scopeKey,
  // Inert rather than loading: with no resolved scope, or with the flow
  // disabled, nothing is being awaited and saying otherwise would render a
  // spinner that never resolves.
  loading: false,
  groups: UNKNOWN_GROUPS,
  recipients: NOT_READ_RECIPIENTS,
  capabilities: UNKNOWN_CAPABILITIES,
  reconciliationFailed: false,
});

const loadingState = (scopeKey: string): ReadState => ({
  ...idleState(scopeKey),
  loading: true,
});

export const useDatasetPermissionsAccess = ({
  scope,
  gateway,
  enabled = true,
}: UseDatasetPermissionsAccessInput): DatasetAccessReadState => {
  const scopeKey = scopeKeyOf(scope);
  const active = enabled && scopeKey !== INACTIVE_SCOPE;

  const principalId = scope?.principalId ?? null;
  const gatewayOrigin = scope?.gatewayOrigin ?? null;
  const datasetId = scope?.datasetId ?? null;

  const [state, setState] = useState<ReadState>(() =>
    active ? loadingState(scopeKey) : idleState(scopeKey),
  );

  // Cleared on the render that changes owner, not in a later effect: an effect
  // would paint one frame of the previous principal's recipients as current,
  // which is exactly what the isolation requirement forbids.
  let current = state;
  if (state.scopeKey !== scopeKey) {
    current = active ? loadingState(scopeKey) : idleState(scopeKey);
    setState(current);
  }

  // A refreshed token produces a new gateway object for the same account. That
  // is not an owner change, so it is read through a ref and never restarts a
  // read or invalidates one in flight.
  const gatewayRef = useRef(gateway);
  useEffect(() => {
    gatewayRef.current = gateway;
  });

  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;

    if (
      !enabled ||
      principalId === null ||
      gatewayOrigin === null ||
      datasetId === null ||
      principalId.trim() === "" ||
      gatewayOrigin.trim() === "" ||
      datasetId.trim() === ""
    ) {
      abortRef.current = null;
      return () => {
        generationRef.current += 1;
      };
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const mine = () => generationRef.current === generation;

    void (async () => {
      const api = gatewayRef.current;

      // Capabilities first. They decide whether the recipient read is worth
      // issuing at all, and a complete negative answers it without a request.
      const [global, datasetContext] = await Promise.all([
        api.readGlobalPermissions(signal),
        api.readDatasetActionPermissions(datasetId, signal),
      ]);
      if (!mine()) return;

      const evidence: ActionEvidence = {
        global: global.evidence,
        datasetContext: datasetContext.evidence,
      };
      const capabilities: AccessCapabilities = {
        grant: decideAction("grant", evidence),
        revoke: decideAction("revoke", evidence),
        // Recipient lookup is a global-only permission at the pinned Gateway:
        // `ContextGrantsDatasetGroupOther` calls plain `AuthorizeForce`, with
        // no affiliated-context alternative. A dataset projection cannot
        // answer it, so the dataset evidence is deliberately withheld here.
        lookupRecipients: decideAction("lookupRecipients", {
          global: global.evidence,
          datasetContext: PERMISSIONS_NOT_READ,
        }),
      };

      const groupsResult = await api.queryGroups(signal);
      if (!mine()) return;
      const groups = groupsResult.state;

      // The one case where *not* asking is the correct behaviour: a complete
      // global read has already established that this caller may not look up
      // another principal's grants. A refusal per group would add nothing.
      if (capabilities.lookupRecipients === "not-permitted") {
        setState((previous) =>
          previous.scopeKey === scopeKey
            ? {
                ...previous,
                loading: false,
                groups,
                recipients: RESTRICTED_RECIPIENTS,
                capabilities,
              }
            : previous,
        );
        return;
      }

      if (groups.kind !== "read" || groups.groups.length === 0) {
        // Nothing to read grants for. The recipient state stays unattempted
        // rather than becoming an empty list of holders.
        setState((previous) =>
          previous.scopeKey === scopeKey
            ? {
                ...previous,
                loading: false,
                groups,
                recipients: NOT_READ_RECIPIENTS,
                capabilities,
              }
            : previous,
        );
        return;
      }

      const recipients = await readAllGroupGrants(
        api,
        groups.groups,
        datasetId,
        signal,
      );
      if (!mine()) return;

      setState((previous) =>
        previous.scopeKey === scopeKey
          ? {
              ...previous,
              loading: false,
              groups,
              recipients,
              capabilities,
            }
          : previous,
      );
    })();

    return () => {
      generationRef.current += 1;
      abortRef.current = null;
      // Abandoning a read costs nothing and tells us nothing, unlike a write.
      controller.abort();
    };
    // `gateway` is read through its ref on purpose: see the comment above it.
  }, [enabled, scopeKey, principalId, gatewayOrigin, datasetId]);

  const reconcileGroup = useCallback(
    (groupId: string) => {
      if (!active || datasetId === null) return;
      // Only where the lookup is actually supported. Where it is not, there is
      // no authoritative read to reconcile against, and the acknowledged
      // outcome stands on its own.
      if (current.recipients.kind !== "known") return;

      const generation = generationRef.current;
      const api = gatewayRef.current;
      const signal = abortRef.current?.signal;

      void (async () => {
        const result = await api.readGroupDatasetGrants(
          groupId,
          datasetId,
          signal,
        );
        if (generationRef.current !== generation) return;

        setState((previous) => {
          if (previous.scopeKey !== scopeKey) return previous;
          if (previous.recipients.kind !== "known") return previous;

          if (result.state.kind !== "known") {
            // A re-read that did not complete is recorded, never applied. The
            // previous knowledge is kept exactly as it was: dropping it would
            // turn a transient failure into "nobody has access", and replacing
            // it with an empty list would look like a rollback of a change the
            // Gateway acknowledged.
            return { ...previous, reconciliationFailed: true };
          }

          const others = previous.recipients.grants.filter(
            (grant) => grant.groupId !== groupId,
          );
          return {
            ...previous,
            reconciliationFailed: false,
            recipients: {
              kind: "known",
              grants: [...others, ...result.state.grants],
            },
          };
        });
      })();
    },
    [active, current.recipients.kind, datasetId, scopeKey],
  );

  const everyone = useMemo(
    () => describeEveryoneDiscovery(current.groups),
    [current.groups],
  );

  const mode = useMemo(
    () =>
      selectAccessMode({
        scopeResolved: active,
        settled: !current.loading,
        capabilities: current.capabilities,
        groups: current.groups,
        recipients: current.recipients,
      }),
    [
      active,
      current.loading,
      current.capabilities,
      current.groups,
      current.recipients,
    ],
  );

  return {
    loading: current.loading,
    groups: current.groups,
    recipients: current.recipients,
    everyone,
    capabilities: current.capabilities,
    mode,
    reconciliationFailed: current.reconciliationFailed,
    reconcileGroup,
  };
};

/**
 * Read every discovered group's grants on this dataset, and treat the result as
 * knowledge only if all of them completed.
 *
 * The Gateway exposes no "who holds a role on this dataset" route, so the
 * answer is assembled one group at a time. A partial assembly is not a shorter
 * true answer — it is a list missing whichever groups happened to fail, which
 * on screen is indistinguishable from those groups holding nothing.
 */
const readAllGroupGrants = async (
  api: DatasetPermissionsGateway,
  groups: readonly UserGroupRef[],
  datasetId: string,
  signal: AbortSignal,
): Promise<RecipientGrantsState> => {
  const results = await Promise.all(
    groups.map((group) =>
      api.readGroupDatasetGrants(group.id, datasetId, signal),
    ),
  );

  // A refusal is reported as it arrived. The selector, not this function,
  // decides whether a refusal is confirmed policy — it holds the caller's
  // capability evidence, and one 403 does not.
  if (results.some((result) => result.state.kind === "unknown")) {
    return RESTRICTED_RECIPIENTS;
  }
  if (results.some((result) => result.state.kind !== "known")) {
    return { kind: "failed" };
  }

  return {
    kind: "known",
    grants: results.flatMap((result) =>
      result.state.kind === "known" ? result.state.grants : [],
    ),
  };
};
