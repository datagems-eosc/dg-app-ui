"use client";

/**
 * Dataset group access — the shared destination.
 *
 * One component, two entry points. The dataset details sidebar and the
 * settings roles table both open *this*, so there is a single place where
 * capability evidence, the read orchestration, the operation lifecycle and the
 * view are composed — and therefore a single answer to "what may this person
 * do with this dataset", rather than one answer per screen.
 *
 * It composes and nothing else. Every decision belongs to a module that can be
 * tested without a DOM:
 *
 *  - `useApi().datasetPermissions` captures the principal and Gateway origin
 *    and binds the adapter to the session transport;
 *  - `useDatasetPermissionsAccess` owns the reads, their cancellation and
 *    ownership, and asks `mode.selectAccessMode` which presentation follows;
 *  - `useDatasetPermissions` owns what may be written, once, and which results
 *    may reach the screen;
 *  - `DatasetAccessView` draws it.
 *
 * The rollout flag is checked here as well as at both entry points. That is
 * deliberate belt and braces for the requirement that the flow issues no
 * requests when it is off: an entry point that forgot to check would still
 * mount an inert component rather than a live reader.
 */

import { useCallback, useEffect, useRef } from "react";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { useApi } from "@/hooks/useApi";
import { useDatasetPermissions } from "@/hooks/useDatasetPermissions";
import {
  type DatasetAccessScope,
  useDatasetPermissionsAccess,
} from "@/hooks/useDatasetPermissionsAccess";
import type { OperationStorageLike } from "@/lib/datasetPermissions/journal";
import { DatasetAccessView } from "./DatasetAccessView";
import type { DatasetAccessReads } from "./types";

export interface DatasetGroupAccessProps {
  readonly datasetId: string;
  readonly datasetName: string;
  /** Closes the surface. Applied changes stay applied; nothing is rolled back. */
  readonly onDone: () => void;
  /**
   * Called when the rollout flag is off while this is mounted, which happens
   * when it is turned off with the surface open. The caller must close, and
   * must **not** open the legacy editor in its place: the flag going away is
   * not a signal that the old path is now correct. Unresolved journal entries
   * are untouched — they are recovery evidence and survive both.
   */
  readonly onUnavailable?: () => void;
  /** Injected in tests. Defaults to this tab's `sessionStorage`. */
  readonly storage?: OperationStorageLike | null;
}

/**
 * The operation journal's store.
 *
 * `sessionStorage`, per design section 4: the journal is tab-local, so it
 * survives closing and reopening the surface or reloading this tab, and is not
 * shared with other tabs. Sharing a key across tabs would not coordinate their
 * writes, so `localStorage` would only suggest a guarantee nobody provides.
 *
 * Resolved once per render rather than captured, and defensively: reading
 * `sessionStorage` throws outright in a browser configured to block site data,
 * and this feature treats "no store" as a hard stop for every mutation rather
 * than as a degraded mode, so it must be able to reach that conclusion without
 * crashing the page.
 */
export const tabStorage = (): OperationStorageLike | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

export function DatasetGroupAccess({
  datasetId,
  datasetName,
  onDone,
  onUnavailable,
  storage,
}: DatasetGroupAccessProps) {
  const enabled = useFeatureFlag("datasetGroupAccess");
  const { datasetPermissions } = useApi();
  const { scope: principalScope, gateway } = datasetPermissions;

  const scope: DatasetAccessScope | null =
    principalScope === null || datasetId.trim() === ""
      ? null
      : {
          principalId: principalScope.principalId,
          gatewayOrigin: principalScope.gatewayOrigin,
          datasetId,
        };

  const access = useDatasetPermissionsAccess({ scope, gateway, enabled });

  // The adapter's mutation half satisfies `DatasetRoleOperations`
  // structurally, so the write hook takes it directly. It is deliberately the
  // *same* object the reads go through: one transport, one captured principal,
  // one 401 policy per method.
  const controller = useDatasetPermissions({
    scope: enabled ? scope : null,
    operations: gateway,
    storage: storage === undefined ? tabStorage() : storage,
    capabilities: {
      grant: access.capabilities.grant,
      revoke: access.capabilities.revoke,
    },
  });

  useEffect(() => {
    if (!enabled) onUnavailable?.();
  }, [enabled, onUnavailable]);

  /**
   * Re-read a group's grants once a change to it is acknowledged.
   *
   * Only acknowledged operations trigger it: a pending one has not happened, a
   * refused one did not, and re-reading after an *uncertain* one would invite
   * treating whatever comes back as the answer — which it is not, because the
   * read and the write may have crossed. Each operation triggers at most one
   * re-read, tracked by operation id, so a rerender does not loop.
   *
   * Nothing here can roll a change back. `rows.ts` keeps an acknowledged
   * operation winning over the read baseline precisely so that a lagging or
   * failed re-read cannot un-apply something the Gateway confirmed.
   */
  const reconciledRef = useRef<Set<string>>(new Set());
  const { reconcileGroup } = access;
  const reconcile = useCallback(reconcileGroup, [reconcileGroup]);

  useEffect(() => {
    for (const operation of controller.operations) {
      if (operation.status !== "acknowledged") continue;
      if (reconciledRef.current.has(operation.operationId)) continue;
      reconciledRef.current.add(operation.operationId);
      reconcile(operation.groupId);
    }
  }, [controller.operations, reconcile]);

  if (!enabled) return null;

  const reads: DatasetAccessReads = access.loading
    ? { status: "loading" }
    : {
        status: "settled",
        groups: access.groups,
        recipients: access.recipients,
      };

  const scopeKey =
    scope === null
      ? ""
      : `${scope.principalId}|${scope.gatewayOrigin}|${scope.datasetId}`;

  return (
    <DatasetAccessView
      datasetName={datasetName}
      mode={access.mode}
      scopeKey={scopeKey}
      reads={reads}
      capabilities={access.capabilities}
      everyone={access.everyone}
      operations={controller.operations}
      storageAvailable={controller.storageAvailable}
      reconciliationFailed={access.reconciliationFailed}
      canAttempt={controller.canAttempt}
      onRoleChange={(groupId, role, action) => {
        controller.requestRoleChange(groupId, role, action);
      }}
      onDone={onDone}
    />
  );
}
