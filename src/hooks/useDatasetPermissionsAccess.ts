"use client";

/**
 * Dataset permissions — the read side, for one dataset, for one owner.
 *
 * `useDatasetPermissions` owns what may be *written*. This hook owns what is
 * *known*: capability evidence, group discovery, the dataset's group
 * inventory, and the presentation those jointly support. It is the feature's
 * single read owner — there is no second state machine here, and every
 * decision is delegated: `model.decideAction` decides capabilities,
 * `model.describeEveryoneDiscovery` decides the public audience, and
 * `mode.selectAccessMode` decides the presentation. What this hook adds is the
 * part none of them can own: *when* a read may start, and whose answer it is
 * when it lands.
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
 *  - the returned refresh actions belong to the **owner lifetime** that
 *    rendered them. One kept across a change of principal, Gateway, dataset or
 *    mount does nothing, so an old handle cannot start a read for its owner and
 *    land it in a successor's view;
 *  - reads are **cancelled** on scope change and unmount. Unlike a mutation,
 *    abandoning a read is free: it tells us nothing and changes nothing on the
 *    server;
 *  - the **gateway is held in a ref**. A same-principal token refresh hands
 *    over a new gateway object for the same account, and that must not restart
 *    reads or discard what they found.
 *
 * The inventory is one dataset-scoped read (Gateway #98), issued on open
 * whatever the capability evidence says — the endpoint enforces access, and
 * the capability only decides what a refusal means. It is never assembled per
 * group, and nothing here falls back to the per-group route.
 *
 * **Ordering.** Every inventory read takes the next number in one sequence:
 * the read on open, an explicit Refresh access, and the read after an
 * acknowledged change. Only the newest number may replace the snapshot, so a
 * read launched before a later acknowledgement can never overwrite what that
 * acknowledgement's own read finds, whichever reply arrives first. A newer
 * demand cancels the older read rather than queueing behind it, so at most one
 * inventory read is current at a time.
 *
 * **Acknowledged changes.** Each one becomes an expectation checked against
 * the next snapshot. A matching read confirms it; a read that disagrees, or a
 * read that fails, leaves it unconfirmed and the inventory stale. Neither ever
 * undoes it — `rows.ts` keeps an unconfirmed acknowledged change on screen —
 * and a stale inventory authorizes no further change until a read succeeds.
 *
 * Deliberately absent: timers, polling, automatic retry, and any reading of an
 * *uncertain* write's outcome. A read can show current roles, but it cannot
 * prove whether a lost request is still in flight or whose change it shows, so
 * uncertain operations are never registered here and never cleared by a read.
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
} from "@/lib/datasetPermissions/model";
import type {
  DatasetRoleAction,
  EveryoneDiscovery,
  GroupDiscoveryState,
  GroupRoleGrant,
  RecipientGrantsState,
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

/** One change the Gateway acknowledged, as the next read should find it. */
export interface AcknowledgedChange {
  readonly operationId: string;
  readonly groupId: string;
  readonly role: string;
  readonly action: DatasetRoleAction;
}

/**
 * How far the displayed inventory can be relied on.
 *
 * - `current`: the newest read succeeded and agrees with every acknowledged
 *   change it was checked against;
 * - `refreshing`: a newer read is in flight. What is shown is the last-known
 *   snapshot, and changes wait for the newer one;
 * - `stale`: the newest read failed, or contradicted an acknowledged change.
 *   The last-known snapshot stays visible, and no change may be made from it.
 */
export type InventoryFreshness = "current" | "refreshing" | "stale";

/**
 * Why the inventory is stale. `change-unconfirmed` means an acknowledged
 * change has not been seen by a later read; `refresh-failed` means only that
 * the last attempt to look again did not complete.
 */
export type InventoryStaleReason = "change-unconfirmed" | "refresh-failed";

export interface DatasetAccessReadState {
  /** `true` until every read this owner needs on open has settled. */
  readonly loading: boolean;
  readonly groups: GroupDiscoveryState;
  /** The last-known inventory; `freshness` says how far it can be relied on. */
  readonly recipients: RecipientGrantsState;
  readonly everyone: EveryoneDiscovery;
  readonly capabilities: AccessCapabilities;
  readonly mode: DatasetAccessMode;
  readonly freshness: InventoryFreshness;
  /** Set only while `freshness` is `stale`. */
  readonly staleReason: InventoryStaleReason | null;
  /**
   * Increases whenever a newer read replaces the snapshot, so a confirmation
   * raised against one inventory can be recognised as obsolete under the next.
   */
  readonly inventoryRevision: number;
  /**
   * Acknowledged changes a later read has matched. Until then the change is
   * drawn from the acknowledgement; from then on, from the read.
   */
  readonly confirmedOperationIds: ReadonlySet<string>;
  /**
   * Read the inventory again: one GET of this dataset's group grants. No
   * write, no group discovery and no capability read is repeated.
   */
  readonly refreshAccess: () => void;
  /** Register acknowledged changes and read the inventory once to check them. */
  readonly refreshAfterAcknowledgement: (
    changes: readonly AcknowledgedChange[],
  ) => void;
}

const NOT_READ_RECIPIENTS: RecipientGrantsState = {
  kind: "unknown",
  reason: "not-read",
};
const UNKNOWN_GROUPS: GroupDiscoveryState = { kind: "unknown" };
const NO_CONFIRMATIONS: ReadonlySet<string> = new Set();

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
  readonly refreshing: boolean;
  readonly staleReason: InventoryStaleReason | null;
  readonly inventoryRevision: number;
  readonly confirmed: ReadonlySet<string>;
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
  refreshing: false,
  staleReason: null,
  inventoryRevision: 0,
  confirmed: NO_CONFIRMATIONS,
});

const loadingState = (scopeKey: string): ReadState => ({
  ...idleState(scopeKey),
  loading: true,
});

const canonical = (value: string): string => value.trim().toLowerCase();

const holds = (
  grants: readonly GroupRoleGrant[],
  groupId: string,
  role: string,
): boolean =>
  grants.some(
    (grant) =>
      grant.groupId === groupId && canonical(grant.role) === canonical(role),
  );

/**
 * What one completed inventory read means for the snapshot on screen.
 *
 * Pure, and computed before `setState`: the expectations are matched against
 * the new grants only, so the updater that applies the result needs nothing
 * but plain values and stays safe to run twice.
 */
interface InventoryOutcome {
  readonly state: RecipientGrantsState;
  /** Expectations this read matched. */
  readonly confirmed: readonly string[];
  /** `true` when a successful read disagreed with an acknowledged change. */
  readonly contradicted: boolean;
  /** `true` when some acknowledged change is still awaiting a matching read. */
  readonly awaiting: boolean;
}

const applyInventory = (
  previous: ReadState,
  outcome: InventoryOutcome,
  revision: number,
): ReadState => {
  if (outcome.state.kind === "known") {
    return {
      ...previous,
      recipients: outcome.state,
      refreshing: false,
      inventoryRevision: revision,
      staleReason: outcome.contradicted ? "change-unconfirmed" : null,
      confirmed:
        outcome.confirmed.length === 0
          ? previous.confirmed
          : new Set([...previous.confirmed, ...outcome.confirmed]),
    };
  }

  // A read that did not complete never replaces a known snapshot: dropping it
  // would turn a transient failure into "nobody has access", and an empty one
  // would look like a rollback of acknowledged changes. The snapshot is kept,
  // marked stale, and changes stop until a read succeeds.
  if (previous.recipients.kind === "known") {
    return {
      ...previous,
      refreshing: false,
      staleReason: outcome.awaiting ? "change-unconfirmed" : "refresh-failed",
    };
  }

  // Nothing known yet: the newer failure is the current answer, so a refused
  // read can still be recognised as the confirmed restriction.
  return {
    ...previous,
    recipients: outcome.state,
    refreshing: false,
    inventoryRevision: revision,
    staleReason: null,
  };
};

export const useDatasetPermissionsAccess = ({
  scope,
  gateway,
  enabled = true,
}: UseDatasetPermissionsAccessInput): DatasetAccessReadState => {
  const scopeKey = scopeKeyOf(scope);
  const active = enabled && scopeKey !== INACTIVE_SCOPE;
  const ownerKey = active ? scopeKey : INACTIVE_SCOPE;

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

  // The owner lifetime this render belongs to, counted during render so a
  // callback knows it before any effect runs, and the lifetime currently
  // mounted, set by the effect and cleared by its teardown. The same pair the
  // write side uses: one knows about a replacement as soon as it renders, the
  // other about an unmount, after which no render follows.
  const lifetimeRef = useRef(0);
  const renderedOwnerKeyRef = useRef<string | null>(null);
  if (renderedOwnerKeyRef.current !== ownerKey) {
    renderedOwnerKeyRef.current = ownerKey;
    lifetimeRef.current += 1;
  }
  const lifetime = lifetimeRef.current;
  const activeLifetimeRef = useRef<number | null>(null);

  /** The newest inventory read number issued; only it may land. */
  const inventorySequenceRef = useRef(0);
  const inventoryAbortRef = useRef<AbortController | null>(null);
  /** Acknowledged changes not yet matched by a read, by operation id. */
  const expectationsRef = useRef<Map<string, AcknowledgedChange>>(new Map());

  /**
   * Read this dataset's inventory under the next sequence number.
   *
   * Returns nothing and needs no caller cleanup: the generation and sequence
   * checks drop a reply nobody may use, and teardown cancels the request.
   */
  const readInventory = useCallback(
    (generation: number, readDatasetId: string, readScopeKey: string) => {
      inventoryAbortRef.current?.abort();
      const controller = new AbortController();
      inventoryAbortRef.current = controller;
      inventorySequenceRef.current += 1;
      const sequence = inventorySequenceRef.current;
      const isCurrent = () =>
        generationRef.current === generation &&
        inventorySequenceRef.current === sequence;

      return (async () => {
        const result = await gatewayRef.current.readDatasetGroupGrants(
          readDatasetId,
          controller.signal,
        );
        if (!isCurrent()) return null;
        if (inventoryAbortRef.current === controller) {
          inventoryAbortRef.current = null;
        }

        const confirmed: string[] = [];
        let contradicted = false;
        if (result.state.kind === "known") {
          for (const [operationId, change] of expectationsRef.current) {
            const found = holds(
              result.state.grants,
              change.groupId,
              change.role,
            );
            if (found === (change.action === "assign")) {
              confirmed.push(operationId);
              expectationsRef.current.delete(operationId);
            } else {
              contradicted = true;
            }
          }
        }

        const outcome: InventoryOutcome = {
          state: result.state,
          confirmed,
          contradicted,
          awaiting: expectationsRef.current.size > 0,
        };
        return { outcome, sequence, readScopeKey };
      })();
    },
    [],
  );

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    expectationsRef.current = new Map();
    activeLifetimeRef.current = null;

    if (
      !enabled ||
      principalId === null ||
      gatewayOrigin === null ||
      datasetId === null ||
      principalId.trim() === "" ||
      gatewayOrigin.trim() === "" ||
      datasetId.trim() === ""
    ) {
      return () => {
        generationRef.current += 1;
      };
    }

    activeLifetimeRef.current = lifetimeRef.current;
    const controller = new AbortController();
    const { signal } = controller;
    const mine = () => generationRef.current === generation;

    void (async () => {
      const api = gatewayRef.current;

      // Independent reads, side by side. A failed group discovery must not
      // hide a successful inventory, and the inventory is read whatever the
      // capability evidence says: the endpoint decides who may see it.
      const [global, datasetContext, groupsResult, inventory] =
        await Promise.all([
          api.readGlobalPermissions(signal),
          api.readDatasetActionPermissions(datasetId, signal),
          api.queryGroups(signal),
          readInventory(generation, datasetId, scopeKey),
        ]);
      if (!mine()) return;

      const evidence: ActionEvidence = {
        global: global.evidence,
        datasetContext: datasetContext.evidence,
      };
      const capabilities: AccessCapabilities = {
        grant: decideAction("grant", evidence),
        revoke: decideAction("revoke", evidence),
        lookupRecipients: decideAction("lookupRecipients", evidence),
      };

      setState((previous) => {
        if (previous.scopeKey !== scopeKey) return previous;
        const settled: ReadState = {
          ...previous,
          loading: false,
          groups: groupsResult.state,
          capabilities,
        };
        // `null` when a newer inventory read has already superseded this one;
        // that read applies its own answer when it lands.
        return inventory === null
          ? settled
          : applyInventory(settled, inventory.outcome, inventory.sequence);
      });
    })();

    return () => {
      generationRef.current += 1;
      activeLifetimeRef.current = null;
      // Abandoning a read costs nothing and tells us nothing, unlike a write.
      controller.abort();
      inventoryAbortRef.current?.abort();
      inventoryAbortRef.current = null;
    };
    // `gateway` is read through its ref on purpose: see the comment above it.
  }, [enabled, scopeKey, principalId, gatewayOrigin, datasetId, readInventory]);

  const loading = current.loading;

  const refresh = useCallback(
    (changes: readonly AcknowledgedChange[]) => {
      // This handle's owner must still be the mounted one; see the lifetime
      // refs above. An obsolete handle reads nothing.
      if (
        lifetimeRef.current !== lifetime ||
        activeLifetimeRef.current !== lifetime ||
        !active ||
        datasetId === null
      ) {
        return;
      }
      // The read on open is still settling; it is the first answer, and a
      // refresh issued now would only cancel it.
      if (loading) return;

      for (const change of changes) {
        expectationsRef.current.set(change.operationId, change);
      }

      const generation = generationRef.current;
      setState((previous) =>
        previous.scopeKey === scopeKey
          ? { ...previous, refreshing: true }
          : previous,
      );

      void readInventory(generation, datasetId, scopeKey).then((read) => {
        if (read === null) return;
        setState((previous) =>
          previous.scopeKey === read.readScopeKey
            ? applyInventory(previous, read.outcome, read.sequence)
            : previous,
        );
      });
    },
    [active, datasetId, lifetime, loading, readInventory, scopeKey],
  );

  const refreshAccess = useCallback(() => refresh([]), [refresh]);

  // Only where an inventory is known. In the grant-only presentation the read
  // is the confirmed restriction, so asking again would spend a refusal to
  // learn nothing; the acknowledged outcome stands on its own there.
  const inventoryKnown = current.recipients.kind === "known";
  const refreshAfterAcknowledgement = useCallback(
    (changes: readonly AcknowledgedChange[]) => {
      if (changes.length > 0 && inventoryKnown) refresh(changes);
    },
    [inventoryKnown, refresh],
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

  const freshness: InventoryFreshness = current.refreshing
    ? "refreshing"
    : current.staleReason !== null
      ? "stale"
      : "current";

  return {
    loading: current.loading,
    groups: current.groups,
    recipients: current.recipients,
    everyone,
    capabilities: current.capabilities,
    mode,
    freshness,
    staleReason: freshness === "stale" ? current.staleReason : null,
    inventoryRevision: current.inventoryRevision,
    confirmedOperationIds: current.confirmed,
    refreshAccess,
    refreshAfterAcknowledgement,
  };
};
