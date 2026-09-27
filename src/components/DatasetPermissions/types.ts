/**
 * Dataset group access — the view's vocabulary.
 *
 * This directory is the presentation `DatasetGroupAccess` mounts inside the
 * existing `ui/user/DatasetPermissionsModal`, from both entry points, while the
 * `datasetGroupAccess` flag is on. Apart from that composition component,
 * nothing here fetches, stores or authorizes; every input is supplied by the
 * caller and every output is a callback.
 *
 * The types below deliberately re-export the shapes `lib/datasetPermissions`
 * and `useDatasetPermissions` already own rather than restating them. A second
 * permission or operation state machine in the view is exactly the thing that
 * would let the screen disagree with the model about whether something is
 * known — so the view derives, and never decides.
 */

import type { PermissionKey } from "@/config/contextGrantRoles";
import type {
  AttemptDecision,
  DatasetRoleOperationState,
} from "@/hooks/useDatasetPermissions";
import type {
  AccessCapabilities,
  DatasetAccessMode,
} from "@/lib/datasetPermissions/mode";
import type {
  DatasetRoleAction,
  EveryoneDiscovery,
  GroupDiscoveryState,
  RecipientGrantsState,
  UncertainOutcomeReason,
} from "@/lib/datasetPermissions/types";

/**
 * Role order, taken from the permissions dropdown in
 * `07-user-profile-permissions/DropDown Menu Permissions View.pdf` and matching
 * the column order the existing modal already renders. The dropdown's "Select
 * All" is deliberately not reused: it is a filter affordance there, and here it
 * would be a bulk mutation this feature does not perform.
 */
export const ACCESS_ROLE_ORDER: readonly PermissionKey[] = [
  "browse",
  "delete",
  "download",
  "edit",
  "manage",
  "search",
];

/**
 * Roles whose grant is explained and confirmed before it is sent. Manage lets
 * the recipient change other principals' access; Delete lets them destroy the
 * dataset. Neither is a reasonable consequence of one mis-aimed click.
 */
export const ELEVATED_ROLES: readonly PermissionKey[] = ["manage", "delete"];

/**
 * Reads, as the view receives them.
 *
 * `loading` is a view state, so it is a status on the envelope rather than a
 * fourth member bolted onto the model's own states. Once settled, discovery and
 * recipient knowledge are the model's types unchanged — and they stay separate,
 * because a list of groups this caller can see says nothing about who holds a
 * role on the dataset.
 */
export type DatasetAccessReads =
  | { readonly status: "loading" }
  | {
      readonly status: "settled";
      readonly groups: GroupDiscoveryState;
      readonly recipients: RecipientGrantsState;
    };

/**
 * What the caller may do, per action, as `model.decideAction` decided it.
 *
 * An alias rather than a second declaration: the selector in
 * `lib/datasetPermissions/mode` decides the presentation from this exact
 * shape, and two structurally identical types would let the view and the
 * selector drift into disagreeing about what "unknown" means.
 */
export type DatasetAccessCapabilities = AccessCapabilities;

/** Effective state of one role for one group, after acknowledged operations. */
export type RoleActivity =
  | { readonly kind: "idle" }
  | { readonly kind: "pending"; readonly action: DatasetRoleAction }
  | { readonly kind: "acknowledged"; readonly action: DatasetRoleAction }
  | { readonly kind: "refused"; readonly action: DatasetRoleAction }
  | {
      readonly kind: "uncertain";
      readonly action: DatasetRoleAction;
      /** Came back from the journal on mount rather than from this session. */
      readonly restored: boolean;
      readonly reason?: UncertainOutcomeReason;
    };

export interface RoleCell {
  readonly key: PermissionKey;
  /** The Gateway role identifier (`dg_ds-browse`), never a display label. */
  readonly role: string;
  readonly label: string;
  readonly elevated: boolean;
  /**
   * Whether the group holds this role *now*, as far as the read plus every
   * acknowledged operation establishes. A refused or uncertain operation moves
   * this not at all: neither proves what the server did.
   */
  readonly granted: boolean;
  readonly activity: RoleActivity;
}

/**
 * A group's relation to the public audience. `ambiguous-public` carries the
 * Everyone semantic while discovery could not identify a single audience: it
 * is neither confirmed as public nor safe to treat as ordinary.
 */
export type GroupAudience = "ordinary" | "public" | "ambiguous-public";

export interface GroupAccessRow {
  readonly groupId: string;
  readonly name: string;
  /** `true` only for the uniquely identified Everyone group. */
  readonly publicAudience: boolean;
  /**
   * `true` for a group carrying the Everyone semantic when several groups do.
   * New assignments to it are unavailable; it is never an ordinary target.
   */
  readonly ambiguousAudience: boolean;
  readonly cells: readonly RoleCell[];
}

/**
 * Why a control is not offered.
 *
 * Wider than the hook's `BlockedReason` in exactly one place: the hook folds
 * "you may not" and "we could not tell" into `not-permitted`, because both
 * refuse. The view has the raw decision and must word them differently, so it
 * keeps `capability-unknown` apart.
 */
export type ControlBlock =
  | "scope-unresolved"
  | "storage-unavailable"
  | "dataset-busy"
  | "not-permitted"
  | "capability-unknown"
  | "in-flight"
  | "uncertain-outcome"
  | "ambiguous-audience";

/** One change awaiting the user's explicit confirmation. Never auto-confirmed. */
export interface PendingConfirmation {
  readonly groupId: string;
  readonly groupName: string;
  readonly publicAudience: boolean;
  readonly roleKey: PermissionKey;
  readonly role: string;
  readonly roleLabel: string;
  readonly action: DatasetRoleAction;
}

/**
 * One group offered as a grant target in the grant-only presentation.
 *
 * Discovery order is preserved. `publicAudience` comes from the Everyone
 * semantic and nothing else: not a name, not a UUID, not visibility.
 */
export interface GrantTargetOption {
  readonly groupId: string;
  readonly name: string;
  readonly publicAudience: boolean;
  /** Carries the Everyone semantic while discovery is ambiguous; not offered. */
  readonly ambiguousAudience: boolean;
}

/** One role offered for a grant. Order follows {@link ACCESS_ROLE_ORDER}. */
export interface GrantRoleOption {
  readonly key: PermissionKey;
  /** The Gateway role identifier (`dg_ds-browse`), never a display label. */
  readonly role: string;
  readonly label: string;
  readonly elevated: boolean;
}

export interface DatasetAccessViewProps {
  readonly datasetName: string;
  /**
   * Which presentation the evidence supports, from
   * `lib/datasetPermissions/mode.selectAccessMode`. The view renders it and
   * never re-derives it: a screen that could pick its own mode is a screen
   * that can disagree with the evidence about what the caller may do.
   */
  readonly mode: DatasetAccessMode;
  /**
   * Opaque key for the owner this view is rendering: principal, Gateway and
   * dataset. Any change to it discards an unconfirmed confirmation on the same
   * render, so a dialog raised under one owner can never dispatch under its
   * replacement.
   */
  readonly scopeKey: string;
  readonly reads: DatasetAccessReads;
  readonly capabilities: DatasetAccessCapabilities;
  readonly everyone: EveryoneDiscovery;
  readonly operations: readonly DatasetRoleOperationState[];
  /** `false` when the operation journal cannot be written. Nothing may be sent. */
  readonly storageAvailable: boolean;
  /**
   * `true` when a read-after-write re-check did not complete. It is a notice,
   * never a state change: no row moves and no acknowledged outcome is undone.
   */
  readonly reconciliationFailed?: boolean;
  readonly canAttempt: (
    groupId: string,
    role: string,
    action: DatasetRoleAction,
  ) => AttemptDecision;
  /** Sends exactly one role change. Never called for more than one at a time. */
  readonly onRoleChange: (
    groupId: string,
    role: string,
    action: DatasetRoleAction,
  ) => void;
  /** Closes the view. Applied changes stay applied; nothing is rolled back. */
  readonly onDone: () => void;
}
