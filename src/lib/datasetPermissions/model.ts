/**
 * Dataset permissions — the pure model.
 *
 * Every decision here is a function of explicitly supplied evidence. Nothing
 * in this module fetches, stores, retries or knows about React, so each rule
 * can be tested with a fixture and none of them can quietly acquire a network
 * dependency later.
 *
 * The one rule the whole module exists to enforce: **absence is not a
 * negative.** A read that failed, was never attempted, or is not supported for
 * this caller leaves the answer `unknown`. Only a completed read can support
 * "not permitted", and only positive evidence can support "allowed".
 *
 * Authorization provenance, dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd`:
 * `Api/Authorization/AuthorizationService` authorizes grant and revoke by
 * global **or** affiliated-context policy, so this model treats a positive in
 * either permission set as sufficient. That combination is a **candidate
 * contract** read from source. It has not been confirmed against a deployed
 * environment (PM-05), and this module is not wired to any live call.
 */

import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  ACCESS_ACTION_NAMES,
  type AccessAction,
  type CapabilityDecision,
  DATASET_CAPABILITY_LABELS,
  type DatasetSharingState,
  type DecodedCallerPermissions,
  EVERYONE_SEMANTIC,
  type GroupDiscoveryState,
  type GroupRoleGrant,
  type PermissionSetEvidence,
  type RecipientGrantsState,
  type SharingDecision,
  type UserGroupRef,
} from "./types";

const canonical = (value: string): string => value.trim().toLowerCase();

/** Evidence constructors. They carry no transport; the caller supplies names. */
export const permissionsRead = (
  names: readonly string[],
): PermissionSetEvidence => ({ kind: "read", names });

export const PERMISSIONS_FAILED: PermissionSetEvidence = { kind: "failed" };
export const PERMISSIONS_NOT_READ: PermissionSetEvidence = { kind: "not-read" };

/**
 * Dataset-scoped evidence built from a decoded dataset payload.
 *
 * A decode that produced no readable evidence becomes `not-read`, never an
 * empty name list, so it cannot contribute to a negative conclusion.
 */
export function datasetPermissionEvidence(
  decoded: DecodedCallerPermissions,
): PermissionSetEvidence {
  if (decoded.kind !== "read") return PERMISSIONS_NOT_READ;
  return permissionsRead(decoded.names);
}

const containsName = (evidence: PermissionSetEvidence, name: string): boolean =>
  evidence.kind === "read" &&
  evidence.names.some((candidate) => canonical(candidate) === canonical(name));

export interface ActionEvidence {
  /** Permission names held globally by the principal, from their own account. */
  readonly global: PermissionSetEvidence;
  /** Permission names assigned for this exact dataset's context. */
  readonly datasetContext: PermissionSetEvidence;
}

/**
 * Decide whether one access action may be offered for this dataset.
 *
 * Only the exact Gateway permission name authorizes. A role identifier such as
 * `dg_ds-manage`, an uploader relationship, an administrator display label or
 * an aggregate `deferredPermissions` entry is not a permission name and can
 * never reach `allowed` through this function.
 *
 * Each action is decided separately: being able to grant does not imply being
 * able to read who already holds a grant, or to revoke one.
 */
export function decideAction(
  action: AccessAction,
  evidence: ActionEvidence,
): CapabilityDecision {
  const name = ACCESS_ACTION_NAMES[action];
  if (containsName(evidence.global, name)) return "allowed";
  if (containsName(evidence.datasetContext, name)) return "allowed";

  const bothReadsComplete =
    evidence.global.kind === "read" && evidence.datasetContext.kind === "read";

  return bothReadsComplete ? "not-permitted" : "unknown";
}

/** Only an explicit `allowed` may enable a mutation control. */
export const mayAttempt = (decision: CapabilityDecision): boolean =>
  decision === "allowed";

/**
 * The grants a view may render. `null` means "do not render a recipient list
 * at all" — a failed or unsupported read must never be drawn as an empty one,
 * which is what would turn a permissions outage into "nobody has access".
 */
export function recipientGrantsForDisplay(
  state: RecipientGrantsState,
): readonly GroupRoleGrant[] | null {
  return state.kind === "known" ? state.grants : null;
}

/**
 * The single group carrying the Everyone semantic, if it is unambiguous.
 *
 * Zero matches is not proof that no such group exists: group discovery returns
 * what *this caller* may see. Multiple matches cannot be resolved safely.
 * Both cases return `null`, and callers must treat that as unknown rather than
 * picking one.
 */
export function findEveryoneGroup(
  groups: readonly UserGroupRef[],
): UserGroupRef | null {
  const matches = groups.filter((group) =>
    (group.semantics ?? []).some(
      (semantic) => canonical(semantic) === EVERYONE_SEMANTIC,
    ),
  );
  return matches.length === 1 ? matches[0] : null;
}

const BROWSE_ROLE = canonical(DATASET_ROLE_MAP.browse);

/**
 * Decide publication from group semantics and the dataset's grant list.
 *
 * The caller's own permissions are deliberately not an input. A principal who
 * can browse a dataset has learned nothing about whether the Everyone audience
 * can, which is the inference the details page used to make.
 */
export function decideSharing(
  groups: GroupDiscoveryState,
  recipients: RecipientGrantsState,
): SharingDecision {
  if (groups.kind === "failed" || recipients.kind === "failed") {
    return { state: "unknown", reason: "read-failed" };
  }
  if (groups.kind !== "read" || recipients.kind !== "known") {
    return { state: "unknown", reason: "no-evidence" };
  }

  const everyone = findEveryoneGroup(groups.groups);
  if (!everyone) {
    return { state: "unknown", reason: "ambiguous-everyone-group" };
  }

  const hasEveryoneBrowse = recipients.grants.some(
    (grant) =>
      grant.groupId === everyone.id && canonical(grant.role) === BROWSE_ROLE,
  );

  return hasEveryoneBrowse
    ? { state: "public", reason: "everyone-browse-grant" }
    : {
        state: "restricted",
        reason: "complete-read-without-everyone-grant",
      };
}

/**
 * No publication evidence is available anywhere in this change: nothing reads
 * groups or dataset grants for the details page. Naming that state once keeps
 * every consumer from inventing a cheerier default.
 */
export const SHARING_WITHOUT_EVIDENCE: SharingDecision = {
  state: "unknown",
  reason: "no-evidence",
};

/**
 * Capability labels for a sidebar-style summary, or `undefined` when there was
 * no readable evidence. `undefined` and `[]` are different states and both are
 * preserved: one means "we could not tell", the other "the read returned
 * nothing we display". Neither may be replaced with an invented role.
 */
export function permissionLabelsForDisplay(
  decoded: DecodedCallerPermissions,
): string[] | undefined {
  if (decoded.kind !== "read") return undefined;
  return decoded.capabilities.map(
    (capability) => DATASET_CAPABILITY_LABELS[capability],
  );
}

/**
 * Existing callers still supply the binary `access` label. Map it rather than
 * dropping it, so a dataset that legitimately carries one keeps its badge;
 * a missing label is unknown, not restricted.
 */
export function sharingStateFromLegacyAccess(
  access: string | undefined,
): DatasetSharingState {
  if (access === "Open Access") return "public";
  if (access === "Restricted") return "restricted";
  return "unknown";
}
