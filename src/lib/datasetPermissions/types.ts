/**
 * Dataset permissions — the vocabulary.
 *
 * Three different questions are answered by three different inputs, and this
 * module keeps them apart by type so a consumer cannot accidentally answer one
 * with the evidence for another:
 *
 * 1. **Caller capabilities** — what the signed-in principal may do with *this*
 *    dataset. Source: the dataset payload's `permissions` projection.
 * 2. **Recipient grants** — which group holds which role on this dataset.
 *    Source: a privileged lookup that an ordinary manager may not be allowed
 *    to perform at all. Not read anywhere in this batch.
 * 3. **Publication** — whether the Everyone audience can browse the dataset.
 *    Source: group semantics plus that same grant read.
 *
 * A caller's own Browse permission answers (1) only. It is not evidence for
 * (2) or (3), which is the misreading this module exists to prevent.
 *
 * Permission-name provenance: dg-app-api
 * `8988a7e879a2239b85dcb4a7f4ce932e368674fd`,
 * `src/DataGEMS.Gateway.App/Authorization/Permission.cs`. Read from the local
 * source clone, not from a live environment. Note what is *not* there: there
 * is no `ManageDataset` permission, and granting is
 * `AddUserToContextGrantGroup`, not a dataset-shaped name.
 */

/** Dataset-scoped permission names, exactly as the Gateway declares them. */
export const DATASET_PERMISSION_NAMES = {
  browse: "BrowseDataset",
  edit: "EditDataset",
  /**
   * Not `DownloadDataset`. The existing details page projected
   * `permissions.downloadDataset`, a name this Gateway revision does not
   * declare, so the permission could never be returned.
   */
  download: "DownloadDatasetFile",
  delete: "DeleteDataset",
  search: "SearchDataset",
} as const;

/**
 * Displayable capabilities.
 *
 * `manage` is deliberately not in {@link DATASET_PERMISSION_NAMES}: this
 * Gateway revision declares no `ManageDataset` permission, so no permission
 * array can ever produce it. It survives only as legacy boolean-object display
 * input, and only as a label. Nothing may be authorized from it — access
 * actions are decided from {@link ACCESS_ACTION_NAMES} instead.
 */
export type DatasetCapability =
  | keyof typeof DATASET_PERMISSION_NAMES
  | "manage";

/**
 * Permission names governing who may read or change *other* principals' access
 * to a dataset. These are global permission names in the Gateway's vocabulary;
 * the same names can also be assigned through an affiliated context, which is
 * why {@link model.decideAction} takes both evidence sources.
 */
export const ACCESS_ACTION_NAMES = {
  grant: "AddUserToContextGrantGroup",
  revoke: "RemoveUserFromContextGrantGroup",
  lookupRecipients: "LookupContextGrantOther",
} as const;

export type AccessAction = keyof typeof ACCESS_ACTION_NAMES;

/** Product-language labels. Gateway spelling stays inside this directory. */
export const DATASET_CAPABILITY_LABELS: Record<DatasetCapability, string> = {
  browse: "Browse",
  edit: "Edit",
  download: "Download",
  delete: "Delete",
  search: "Search",
  manage: "Manage",
};

/**
 * What the caller may do with the dataset, as decoded from one payload.
 *
 * `absent` is not "no permissions". It means the payload carried no readable
 * permission evidence, and the only honest thing a view can do with it is say
 * so. An empty `capabilities` list under `kind: "read"` is the opposite: a
 * complete answer that happens to contain nothing we display.
 */
export type DecodedCallerPermissions =
  | {
      readonly kind: "read";
      /** Which payload shape produced this, for diagnosis and reporting. */
      readonly source: "array" | "legacy-object";
      readonly capabilities: readonly DatasetCapability[];
      /**
       * Every permission name this read reported as held, exactly as it
       * arrived. The capability list is the displayable subset; this is the
       * whole answer, and it is what action decisions are made from, because
       * the names that authorize granting are not dataset capabilities.
       */
      readonly names: readonly string[];
      /**
       * Names the Gateway returned that this revision of the UI does not
       * recognise as a displayable capability. Preserved deliberately: an
       * unknown name is evidence that the contract moved or that a different
       * projection was requested, never an extra action to offer.
       */
      readonly unrecognized: readonly string[];
    }
  | { readonly kind: "absent"; readonly reason: AbsentReason };

export type AbsentReason =
  /** The field was missing, null, or not an array or object. */
  | "missing"
  /** Entries were present but none could be interpreted as permissions. */
  | "unreadable";

/**
 * A set of permission names as an actual read, a failure, or a read that was
 * never attempted. The three are kept apart because only a *completed* read
 * can support a negative conclusion.
 *
 * Never build this from `Account.deferredPermissions`: that field aggregates
 * context roles across every target the principal touches, so it cannot say
 * anything about one dataset.
 */
export type PermissionSetEvidence =
  | { readonly kind: "read"; readonly names: readonly string[] }
  | { readonly kind: "failed" }
  | { readonly kind: "not-read" };

/** A group's role assignment on one dataset. */
export interface GroupRoleGrant {
  readonly groupId: string;
  /** The Gateway role identifier, e.g. `dg_ds-browse`. Not a display label. */
  readonly role: string;
}

/** A user group as returned by the group query, with requested semantics. */
export interface UserGroupRef {
  readonly id: string;
  readonly name?: string;
  readonly semantics?: readonly string[];
}

/**
 * What is known about which groups hold roles on the dataset.
 *
 * `failed` and `unknown` are separate from `known` with an empty list so that
 * a refused or broken read can never be rendered as "nobody has access".
 */
export type RecipientGrantsState =
  | { readonly kind: "known"; readonly grants: readonly GroupRoleGrant[] }
  | { readonly kind: "unknown"; readonly reason: "not-read" | "not-supported" }
  | { readonly kind: "failed" };

/** Groups discovered for this caller, used only to find the Everyone audience. */
export type GroupDiscoveryState =
  | { readonly kind: "read"; readonly groups: readonly UserGroupRef[] }
  | { readonly kind: "unknown" }
  | { readonly kind: "failed" };

/**
 * Publication as far as the UI can honestly claim it.
 *
 * `restricted` means a complete, supported read showed no Everyone browse
 * grant. It does not mean nobody else can reach the dataset: other groups,
 * roles and collection paths exist and are not part of this evidence.
 */
export type DatasetSharingState = "public" | "restricted" | "unknown";

export type SharingReason =
  | "everyone-browse-grant"
  | "complete-read-without-everyone-grant"
  | "no-evidence"
  | "read-failed"
  | "ambiguous-everyone-group";

export interface SharingDecision {
  readonly state: DatasetSharingState;
  readonly reason: SharingReason;
}

/** Whether an action may be offered. `unknown` is never treated as allowed. */
export type CapabilityDecision = "allowed" | "not-permitted" | "unknown";

/** The semantic marking the public audience. Never match on name or UUID. */
export const EVERYONE_SEMANTIC = "everyone";
