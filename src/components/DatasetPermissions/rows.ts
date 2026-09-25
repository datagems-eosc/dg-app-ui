/**
 * Dataset group access — deriving what to draw.
 *
 * Pure functions over the read states and the operation list. They exist so
 * the interesting rule — *which evidence is allowed to move a switch* — can be
 * tested without a DOM, and so the component cannot quietly acquire a second
 * copy of it.
 *
 * The rule: a completed recipient read establishes the baseline, and only an
 * **acknowledged** operation moves it. A pending operation has not happened
 * yet, a refused one did not happen, and an uncertain one is unknown — drawing
 * any of the three as a changed switch would be the UI asserting something the
 * server never told it.
 */

import {
  DATASET_ROLE_MAP,
  type PermissionKey,
} from "@/config/contextGrantRoles";
import type { DatasetRoleOperationState } from "@/hooks/useDatasetPermissions";
import {
  DATASET_CAPABILITY_LABELS,
  EVERYONE_SEMANTIC,
  type GroupRoleGrant,
  type RecipientGrantsState,
  type UserGroupRef,
} from "@/lib/datasetPermissions/types";
import {
  ACCESS_ROLE_ORDER,
  ELEVATED_ROLES,
  type GrantRoleOption,
  type GrantTargetOption,
  type GroupAccessRow,
  type GroupAudience,
  type RoleActivity,
  type RoleCell,
} from "./types";

const canonical = (value: string): string => value.trim().toLowerCase();

const IDLE: RoleActivity = { kind: "idle" };

/**
 * How a group relates to the public audience, from its own semantics.
 *
 * A group carrying the Everyone semantic stays marked as such even when the
 * canonical audience cannot be chosen: several matches make none of them
 * public, but they do not make any of them ordinary. `ambiguous-public` is a
 * group that *may* be the public audience, and new assignments to it are
 * refused rather than sent without the public-audience confirmation.
 */
export const audienceOf = (
  group: UserGroupRef,
  everyoneGroupId: string | null,
): GroupAudience => {
  const carriesEveryone = (group.semantics ?? []).some(
    (semantic) => canonical(semantic) === EVERYONE_SEMANTIC,
  );
  if (!carriesEveryone) return "ordinary";
  return everyoneGroupId !== null && group.id === everyoneGroupId
    ? "public"
    : "ambiguous-public";
};

/** A group with no usable `name` still needs something to point at. */
export const groupLabel = (group: UserGroupRef): string => {
  const name = group.name?.trim();
  return name !== undefined && name.length > 0
    ? name
    : `Unnamed group ${group.id}`;
};

const holdsRole = (
  grants: readonly GroupRoleGrant[],
  groupId: string,
  role: string,
): boolean =>
  grants.some(
    (grant) =>
      grant.groupId === groupId && canonical(grant.role) === canonical(role),
  );

/** How one recorded operation is presented. Shared by both presentations. */
export const activityOf = (
  operation: DatasetRoleOperationState | undefined,
): RoleActivity => {
  if (operation === undefined) return IDLE;
  switch (operation.status) {
    case "pending":
      return { kind: "pending", action: operation.action };
    case "acknowledged":
      return { kind: "acknowledged", action: operation.action };
    case "refused":
      return { kind: "refused", action: operation.action };
    default:
      return {
        kind: "uncertain",
        action: operation.action,
        restored: operation.restored,
        ...(operation.uncertainReason === undefined
          ? {}
          : { reason: operation.uncertainReason }),
      };
  }
};

/** NUL-separated, so no group id or role text can forge another assignment. */
const operationKey = (groupId: string, role: string): string =>
  `${groupId}\u0000${canonical(role)}`;

/** The newest operation recorded for one assignment, whatever its status. */
export const latestOperationFor = (
  operations: readonly DatasetRoleOperationState[],
  groupId: string,
  role: string,
): DatasetRoleOperationState | undefined =>
  indexOperations(operations).latest.get(operationKey(groupId, role));

interface OperationIndex {
  /** Newest operation per assignment, whatever its status. Drives the label. */
  readonly latest: ReadonlyMap<string, DatasetRoleOperationState>;
  /**
   * Newest *acknowledged* operation per assignment. The only one that moves a
   * switch, because it is the only one the server confirmed.
   */
  readonly settled: ReadonlyMap<string, DatasetRoleOperationState>;
}

export const indexOperations = (
  operations: readonly DatasetRoleOperationState[],
): OperationIndex => {
  const latest = new Map<string, DatasetRoleOperationState>();
  const settled = new Map<string, DatasetRoleOperationState>();
  for (const operation of operations) {
    const key = operationKey(operation.groupId, operation.role);
    latest.set(key, operation);
    if (operation.status === "acknowledged") settled.set(key, operation);
  }
  return { latest, settled };
};

/** Whether anything at all is in flight for this dataset. */
export const hasPendingWrite = (
  operations: readonly DatasetRoleOperationState[],
): boolean => operations.some((operation) => operation.status === "pending");

/**
 * Operations whose outcome is unknown, newest last. Shown as a standing notice
 * rather than only as a per-switch marker: an uncertain write is a fact about
 * the dataset that outlives whichever row it happened on.
 */
export const uncertainOperations = (
  operations: readonly DatasetRoleOperationState[],
): readonly DatasetRoleOperationState[] =>
  operations.filter((operation) => operation.status === "uncertain");

export interface BuildRowsInput {
  readonly groups: readonly UserGroupRef[];
  /** Only a `known` recipient read produces rows; see {@link buildAccessRows}. */
  readonly recipients: RecipientGrantsState;
  readonly operations: readonly DatasetRoleOperationState[];
  /** From `model.describeEveryoneDiscovery`; `null` when it is not identified. */
  readonly everyoneGroupId: string | null;
}

/**
 * Build the rows, or `null` when there is nothing truthful to draw.
 *
 * `null` for any recipient state other than `known` is the whole point: a
 * denied, failed or unattempted read rendered as a grid of off switches would
 * tell the user that nobody has access, which is a claim the UI has no basis
 * for. The caller renders an explanation instead.
 */
export function buildAccessRows({
  groups,
  recipients,
  operations,
  everyoneGroupId,
}: BuildRowsInput): readonly GroupAccessRow[] | null {
  if (recipients.kind !== "known") return null;

  const { latest, settled } = indexOperations(operations);

  return groups.map((group) => {
    const cells: readonly RoleCell[] = ACCESS_ROLE_ORDER.map(
      (key: PermissionKey): RoleCell => {
        const role = DATASET_ROLE_MAP[key];
        const mapKey = operationKey(group.id, role);
        const acknowledged = settled.get(mapKey);
        const granted =
          acknowledged === undefined
            ? holdsRole(recipients.grants, group.id, role)
            : acknowledged.action === "assign";

        return {
          key,
          role,
          label: DATASET_CAPABILITY_LABELS[key],
          elevated: ELEVATED_ROLES.includes(key),
          granted,
          activity: activityOf(latest.get(mapKey)),
        };
      },
    );

    const audience = audienceOf(group, everyoneGroupId);
    return {
      groupId: group.id,
      name: groupLabel(group),
      publicAudience: audience === "public",
      ambiguousAudience: audience === "ambiguous-public",
      cells,
    };
  });
}

/**
 * The roles a grant may be made for, in the design's order.
 *
 * A constant rather than a prop: the set is the Gateway's dataset role map,
 * and letting a caller narrow it here would be a second place where an action
 * can quietly disappear. Whether a particular grant may be *attempted* is a
 * capability question, answered per attempt, not by hiding the option.
 */
export const GRANT_ROLE_OPTIONS: readonly GrantRoleOption[] =
  ACCESS_ROLE_ORDER.map((key: PermissionKey) => ({
    key,
    role: DATASET_ROLE_MAP[key],
    label: DATASET_CAPABILITY_LABELS[key],
    elevated: ELEVATED_ROLES.includes(key),
  }));

/**
 * The groups a grant may be offered to, in discovery order.
 *
 * Unlike {@link buildAccessRows} this needs no recipient knowledge: the
 * grant-only presentation exists precisely because there is none. Discovery
 * visibility is not evidence of permission to grant — every attempt is still
 * checked — and it is not an inventory of who can reach the dataset either.
 */
export const buildGrantTargets = (
  groups: readonly UserGroupRef[],
  everyoneGroupId: string | null,
): readonly GrantTargetOption[] =>
  groups.map((group) => {
    const audience = audienceOf(group, everyoneGroupId);
    return {
      groupId: group.id,
      name: groupLabel(group),
      publicAudience: audience === "public",
      ambiguousAudience: audience === "ambiguous-public",
    };
  });

/**
 * The display label for a Gateway role identifier, for feedback about an
 * operation. An identifier outside the dataset role map is shown as is rather
 * than guessed at.
 */
export const roleLabelOf = (role: string): string =>
  GRANT_ROLE_OPTIONS.find(
    (option) => canonical(option.role) === canonical(role),
  )?.label ?? role;
