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
 * How much of a permission name space one completed read actually covers.
 *
 * This is the representation PM-01 finding F3 found missing. The Gateway's
 * dataset projection returns the intersection of the names the *request* asked
 * for with the names the principal holds, so a name that was never requested
 * is missing from the response for a reason that has nothing to do with
 * authorization. Without recording what was asked for, a read that projected
 * browse/edit/download could be read as proof that granting is not permitted.
 *
 * - `exhaustive`: the read returns every name held in its scope, so absence
 *   within it is a real negative for any name. `GET /principal/me?f=permissions`
 *   is the one such read here — `AccountBuilder.Build` emits the principal's
 *   whole global permission set, not a projection by name.
 * - `projected`: the read returns only the names in `requested`. Absence is a
 *   negative *only* for those names; for anything else the read is silent.
 *   `GET /dataset/{id}?f=permissions.<name>` is this case, via
 *   `Extensions.ReduceToAssignedPermissions`.
 */
export type PermissionReadCoverage =
  | { readonly kind: "exhaustive" }
  | { readonly kind: "projected"; readonly requested: readonly string[] };

/**
 * A set of permission names as an actual read, a failure, or a read that was
 * never attempted. The three are kept apart because only a *completed* read
 * can support a negative conclusion — and, per {@link PermissionReadCoverage},
 * only for the names that read actually covered.
 *
 * Never build this from `Account.deferredPermissions`: that field aggregates
 * context roles across every target the principal touches, so it cannot say
 * anything about one dataset.
 */
export type PermissionSetEvidence =
  | {
      readonly kind: "read";
      readonly names: readonly string[];
      readonly coverage: PermissionReadCoverage;
    }
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

// ---------------------------------------------------------------------------
// Explicit role operations
// ---------------------------------------------------------------------------

/**
 * The two mutations this feature performs, named after what they do to one
 * group's role on one dataset. They are not "save" and "cancel": each is a
 * separate request with its own outcome, and neither undoes the other.
 */
export type DatasetRoleAction = "assign" | "remove";

/** The inverse of an action, for the rule that an uncertain write blocks it. */
export const INVERSE_ACTION: Record<DatasetRoleAction, DatasetRoleAction> = {
  assign: "remove",
  remove: "assign",
};

/**
 * One deliberate role change, frozen before anything is awaited.
 *
 * Every field is captured at the moment the user acted, so a later render, a
 * refreshed token or a changed selection cannot alter what a request in flight
 * is about. `role` is the Gateway role identifier (`dg_ds-browse`), not a
 * display label: `DATASET_ROLE_MAP` maps one to the other.
 */
export interface DatasetRoleOperation {
  /** Unique within the tab. Correlates the journal entry with the request. */
  readonly operationId: string;
  readonly datasetId: string;
  readonly groupId: string;
  readonly role: string;
  readonly action: DatasetRoleAction;
}

/**
 * Why a mutation's result could not be established.
 *
 * All three mean the same thing to the user — the server may or may not have
 * applied the change — and are distinguished only so an operator can tell a
 * dropped connection from a refused dependency.
 */
export type UncertainOutcomeReason =
  /** The request never produced a response: connection error, not an abort. */
  | "no-response"
  /** Aborted locally after dispatch. The server may still have applied it. */
  | "aborted"
  /** A response arrived whose status does not prove anything either way. */
  | "inconclusive-status";

/**
 * The outcome of one role operation.
 *
 * `refused` is claimed only where the pinned Gateway source proves the refusal
 * happened before any side effect; see `gateway.ts` for that trace. Everything
 * else is `uncertain`, which is not a failure: it is the absence of knowledge,
 * and it is never resolved by retrying, waiting or reloading.
 */
export type DatasetRoleOutcome =
  | { readonly kind: "acknowledged"; readonly httpStatus: number }
  | { readonly kind: "refused"; readonly httpStatus: number }
  | {
      readonly kind: "uncertain";
      readonly reason: UncertainOutcomeReason;
      readonly httpStatus?: number;
    };

/**
 * Whether the Everyone audience can be addressed at all.
 *
 * Separating the reasons matters for the spec's "useful explanation": a caller
 * whose group query returned no semantics at all is in a different situation
 * from one whose deployment genuinely has several Everyone-like groups, and
 * neither may be resolved by picking a group.
 */
export type EveryoneDiscovery =
  | { readonly kind: "identified"; readonly group: UserGroupRef }
  | {
      readonly kind: "unavailable";
      readonly reason: /** Groups were read; none carries the semantic. */
        | "no-match"
        /** Several carry it; choosing one would be a guess. */
        | "multiple-matches"
        /** No group came back with a `semantics` field to match on at all. */
        | "semantics-unavailable"
        /** The group read failed or was never attempted. */
        | "groups-unknown";
    };
