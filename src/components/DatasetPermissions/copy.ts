/**
 * Dataset group access — what the view says.
 *
 * Kept in one place so the whole surface reads as one voice. The wording has
 * to preserve a few distinctions, not particular phrases:
 *
 *  - missing information is not an empty result: a list the caller cannot
 *    read is never worded as "nobody has access";
 *  - unknown is not failed: a change we could not confirm is never reported as
 *    applied or as not applied;
 *  - Browse, even for everyone, means signed-in DataGEMS users can find and
 *    open the dataset — not downloading, and not anonymous publication;
 *  - closing is not undo.
 *
 * Explanations of *why* (journals, requests, Gateway policy) belong in code
 * comments and reports, not in the product. Say what happened, which group and
 * permission it concerns, and what the person can do next.
 */

import type { PermissionKey } from "@/config/contextGrantRoles";
import type { AccessUnavailableReason } from "@/lib/datasetPermissions/mode";
import type {
  CapabilityDecision,
  DatasetRoleAction,
  EveryoneDiscovery,
  GroupDiscoveryState,
} from "@/lib/datasetPermissions/types";
import type { ControlBlock, RoleActivity } from "./types";

export const VIEW_INTRO = "Changes apply immediately.";

/**
 * Group discovery returns what *this caller* may see. Saying so once is the
 * difference between a list and a claim about the world.
 */
export const DISCOVERY_CAVEAT =
  "Only groups you can view are shown. Other users or groups may also have access.";

export const LOADING_MESSAGE = "Loading group permissions…";

export const DONE_LABEL = "Done";

export const groupsUnavailableMessage = (
  groups: GroupDiscoveryState,
): string | null => {
  if (groups.kind === "read") return null;
  return groups.kind === "failed"
    ? "We couldn't load the groups. Close and reopen this window to try again."
    : "Group information is unavailable.";
};

/** Shown with {@link DISCOVERY_CAVEAT}, which keeps it from reading as "nobody". */
export const EMPTY_DISCOVERY_MESSAGE =
  "No groups are available to your account.";

export const SEARCH_PLACEHOLDER = "Search groups";

export const noSearchMatchesMessage = (query: string): string =>
  `No groups match “${query}”.`;

const CAPABILITY_MESSAGE: Record<
  DatasetRoleAction,
  Record<Exclude<CapabilityDecision, "allowed">, string>
> = {
  assign: {
    "not-permitted":
      "You don't have permission to grant access to this dataset.",
    unknown: "We couldn't check whether you can grant access.",
  },
  remove: {
    "not-permitted":
      "You don't have permission to remove access from this dataset.",
    unknown: "We couldn't check whether you can remove access.",
  },
};

/**
 * Only for the full editor, where both actions exist. "Unknown" is never
 * worded as a confirmed denial.
 */
export const capabilityMessage = (
  action: DatasetRoleAction,
  decision: CapabilityDecision,
): string | null =>
  decision === "allowed" ? null : CAPABILITY_MESSAGE[action][decision];

export const STORAGE_UNAVAILABLE_TITLE =
  "Access changes are unavailable in this browser tab.";

/**
 * Blocked before anything is sent. Not a claim that earlier changes did
 * nothing, and no unsupported recovery advice.
 */
export const STORAGE_UNAVAILABLE_MESSAGE =
  "We couldn't safely save your progress, so no new change was sent. If this continues, ask a DataGEMS administrator for help.";

export const DATASET_BUSY_MESSAGE =
  "Applying change… Wait for it to finish before making another.";

/** The dataset-wide summary. Detail sits with the affected group. */
export const uncertainNoticeMessage = (count: number): string =>
  count === 1
    ? "We couldn't confirm one access change."
    : `We couldn't confirm ${count} access changes.`;

export const CHECK_WITH_ADMIN =
  "Ask a DataGEMS administrator to check access before trying this change again.";

/**
 * Everyone, when it cannot be identified.
 *
 * Only several matches earns a notice: those candidates are on screen and
 * cannot be chosen. A missing marking or no match is a quiet caption, and a
 * failed group read is already explained by the group-load message.
 */
export const everyoneUnavailableMessage = (
  everyone: EveryoneDiscovery,
): string | null => {
  if (everyone.kind === "identified") return null;
  switch (everyone.reason) {
    case "multiple-matches":
      return AMBIGUOUS_AUDIENCE_MESSAGE;
    case "groups-unknown":
      return null;
    default:
      return EVERYONE_NOT_OFFERED_MESSAGE;
  }
};

export const EVERYONE_NOT_OFFERED_MESSAGE =
  "Sharing with all DataGEMS users isn't available here.";

export const PUBLIC_AUDIENCE_BADGE = "All DataGEMS users";

/** A group carrying the Everyone semantic while several groups do. */
export const AMBIGUOUS_AUDIENCE_BADGE = "Group needs checking";

export const AMBIGUOUS_AUDIENCE_MESSAGE =
  "Access to all DataGEMS users is unavailable. We couldn't identify the correct group. Ask an administrator for help.";

/** Beside the grant-only chooser, explaining its disabled options once. */
export const AMBIGUOUS_CHOOSER_HINT =
  "Groups marked “needs checking” can't be chosen: we couldn't identify which one includes all DataGEMS users. Ask an administrator for help.";

export const PUBLIC_AUDIENCE_HINT =
  "This group includes everyone who can sign in to DataGEMS.";

// ---------------------------------------------------------------------------
// Operation feedback
// ---------------------------------------------------------------------------

/**
 * One change's feedback in the full editor, placed below the group's row.
 *
 * It names the permission and the recorded direction, because it no longer
 * sits under the switch it concerns. The direction comes from the operation,
 * never from the switch's current position.
 */
export const rowFeedbackText = (
  activity: Exclude<RoleActivity, { kind: "idle" }>,
  permission: string,
): string => {
  const grant = activity.action === "assign";
  switch (activity.kind) {
    case "pending":
      return grant ? `Granting ${permission}…` : `Removing ${permission}…`;
    case "acknowledged":
      return grant
        ? `${permission} permission granted.`
        : `${permission} permission removed.`;
    case "refused":
      return grant
        ? `${permission} permission wasn't granted.`
        : `${permission} permission wasn't removed.`;
    default:
      return `${permission}: ${
        activity.restored
          ? grant
            ? "we couldn't confirm whether an earlier grant was applied."
            : "we couldn't confirm whether an earlier removal was applied."
          : grant
            ? "we couldn't confirm whether it was granted."
            : "we couldn't confirm whether it was removed."
      } ${CHECK_WITH_ADMIN}`;
  }
};

/**
 * One change's result in the grant-only form, naming group and permission.
 * "Granted" acknowledges this change only; it is not an inventory of who has
 * access.
 */
export const grantResultText = (
  activity: Exclude<RoleActivity, { kind: "idle" }>,
  permission: string,
  group: string,
): string => {
  const grant = activity.action === "assign";
  switch (activity.kind) {
    case "pending":
      return grant
        ? `Granting ${permission} to ${group}…`
        : `Removing ${permission} from ${group}…`;
    case "acknowledged":
      return grant
        ? `${permission} permission granted to ${group}.`
        : `${permission} permission removed from ${group}.`;
    case "refused":
      return grant
        ? `${permission} permission wasn't granted to ${group}.`
        : `${permission} permission wasn't removed from ${group}.`;
    default: {
      const what = activity.restored
        ? grant
          ? `an earlier ${permission} grant to ${group} was applied`
          : `an earlier ${permission} removal from ${group} was applied`
        : grant
          ? `${permission} permission was granted to ${group}`
          : `${permission} permission was removed from ${group}`;
      return `We couldn't confirm whether ${what}. ${CHECK_WITH_ADMIN}`;
    }
  }
};

/**
 * A group the operation concerns that this render cannot name — outside the
 * current discovery. The id fragment keeps two such groups apart.
 */
export const unlistedGroupLabel = (groupId: string): string =>
  `an unlisted group (ID ${groupId.slice(0, 8)})`;

// ---------------------------------------------------------------------------
// The grant-only presentation
// ---------------------------------------------------------------------------

export const GRANT_ONLY_TITLE = "Grant access";

export const grantOnlyIntro = (datasetName: string): string =>
  `Choose a group and the permission you want to give it for “${datasetName}”.`;

/** The limitation, once. Not a claim that nobody has access. */
export const GRANT_ONLY_EXISTING_ACCESS =
  "You can grant access, but your account can't view existing permissions. To review or remove them, ask a DataGEMS administrator.";

export const GRANT_GROUP_LABEL = "Group";
export const GRANT_ROLE_LABEL = "Permission";
export const GRANT_SUBMIT_LABEL = "Grant access";
export const GRANT_GROUP_PLACEHOLDER = "Choose a group";
export const GRANT_RESULTS_LABEL = "Your changes";

/** Points the top summary to the named results below the form. */
export const GRANT_RESULTS_POINTER = "Details are under Your changes.";

export const GRANT_INCOMPLETE_MESSAGE =
  "Choose a group and a permission first.";

/**
 * Why the *selected* group and permission cannot be granted right now. Names
 * both, so the disabled button is never unexplained.
 */
export const selectedGrantBlockMessage = (
  block: ControlBlock,
  permission: string,
  group: string,
): string => {
  switch (block) {
    case "uncertain-outcome":
      // The named result below says why and who to ask; don't repeat it.
      return `You can't change ${permission} for ${group} until access has been checked.`;
    case "in-flight":
    case "dataset-busy":
      return "Wait for the current change to finish.";
    case "ambiguous-audience":
      return `${group} needs checking before it can be given access.`;
    default:
      return blockMessage(block);
  }
};

/**
 * Why neither presentation is offered. Unknown is never presented as policy,
 * and a failed read is never presented as empty.
 */
export const accessUnavailableMessage = (
  reason: AccessUnavailableReason,
): string => {
  switch (reason) {
    case "identity-unresolved":
      return "We couldn't load access settings for this dataset.";
    case "recipient-read-failed":
    case "recipient-read-refused":
      return "We couldn't load existing permissions. Close and reopen this window to try again.";
    case "lookup-unconfirmed":
      return "We couldn't load your access settings. Close and reopen this window to try again.";
    case "no-grant-capability":
      return "Access settings aren't available for your account. Ask a DataGEMS administrator for help.";
    default:
      return "No groups are available to your account, so there is no group to grant access to.";
  }
};

/** After an acknowledged change: the change stays applied. */
export const RECONCILIATION_FAILED_MESSAGE =
  "Your change was applied, but we couldn't refresh the permissions list.";

export const ACCESS_UNAVAILABLE_TITLE = "Access settings unavailable";

export const blockMessage = (block: ControlBlock): string => {
  switch (block) {
    case "scope-unresolved":
      return "Access settings aren't ready yet.";
    case "storage-unavailable":
      return STORAGE_UNAVAILABLE_TITLE;
    case "dataset-busy":
      return "Wait for the current change to finish.";
    case "not-permitted":
      return "You don't have permission to make this change.";
    case "capability-unknown":
      return "We couldn't check whether you can make this change.";
    case "in-flight":
      return "This change is being applied.";
    case "ambiguous-audience":
      return "This group needs checking before it can be given access.";
    default:
      return `We couldn't confirm an earlier change to this permission. ${CHECK_WITH_ADMIN}`;
  }
};

// ---------------------------------------------------------------------------
// Confirmations
// ---------------------------------------------------------------------------

const ELEVATED_CONSEQUENCE: Partial<Record<PermissionKey, string>> = {
  manage: "This group will be able to change who has access to the dataset.",
  delete: "This group will be able to permanently delete the dataset.",
};

const EVERYONE_CONSEQUENCE: Partial<Record<PermissionKey, string>> = {
  browse:
    "Everyone who can sign in to DataGEMS will be able to find and open this dataset. This doesn't include downloading files.",
  manage:
    "Everyone who can sign in to DataGEMS will be able to change who has access to the dataset.",
  delete:
    "Everyone who can sign in to DataGEMS will be able to permanently delete the dataset.",
};

export interface ConfirmationCopy {
  readonly title: string;
  readonly message1: string;
  readonly message2: string;
  readonly confirmText: string;
  readonly confirmVariant: "primary" | "danger";
}

export interface ConfirmationSubject {
  readonly datasetName: string;
  readonly groupName: string;
  readonly roleKey: PermissionKey;
  readonly roleLabel: string;
  readonly action: DatasetRoleAction;
  readonly publicAudience: boolean;
}

/**
 * Confirmation wording, always naming the dataset, the group and the exact
 * permission. Removal does not promise the group has lost every route to the
 * dataset.
 */
export function confirmationCopy({
  datasetName,
  groupName,
  roleKey,
  roleLabel,
  action,
  publicAudience,
}: ConfirmationSubject): ConfirmationCopy {
  if (action === "remove") {
    return {
      title: `Remove ${roleLabel} permission?`,
      message1: `Remove ${roleLabel} permission for “${groupName}” on “${datasetName}”?`,
      message2: "The group may still have access through other permissions.",
      confirmText: `Remove ${roleLabel}`,
      confirmVariant: "danger",
    };
  }

  const elevated = ELEVATED_CONSEQUENCE[roleKey];
  const message2 = publicAudience
    ? (EVERYONE_CONSEQUENCE[roleKey] ??
      `Everyone who can sign in to DataGEMS will get ${roleLabel} permission for this dataset.`)
    : (elevated ?? "Other permissions won't change.");

  return {
    title: publicAudience
      ? "Grant access to all DataGEMS users?"
      : `Grant ${roleLabel} permission?`,
    message1: `Give “${groupName}” ${roleLabel} permission for “${datasetName}”?`,
    message2,
    confirmText: `Grant ${roleLabel}`,
    confirmVariant: elevated === undefined ? "primary" : "danger",
  };
}
