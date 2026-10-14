/**
 * Fixtures for endpoints that exist at the pinned Gateway revision.
 *
 * "Current" means the route is real and reachable today — not that any of this
 * was observed. See `./provenance.ts`.
 *
 * The two reads that behave differently by caller are labelled by caller:
 * `currentAdmin*` is what a principal holding the global permissions would
 * receive, `deniedManager*` is what an ordinary manager receives from the same
 * route. Keeping them apart in the fixture names is the point — an
 * administrator's success is not evidence about a manager, and PM-C1 and 4.3
 * both turn on not confusing the two.
 *
 * The recipient read moved to the dataset-scoped route in Gateway #98; its
 * fixtures are at the end of this file and pinned to a later revision.
 */

export const DATASET_ID = "3e0a9d64-2c51-4b8f-9a7d-6f1b0c2e4d75";
export const OTHER_DATASET_ID = "b7c1e4a2-9d38-4f60-8c25-1a7e3b9d05f4";

export const EVERYONE_GROUP_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
export const RESEARCH_GROUP_ID = "5f6e7d8c-9b0a-41c2-83d4-e5f6a7b8c9d0";
export const SECOND_GROUP_ID = "9c8b7a65-4321-4def-90ab-cdef01234567";

/**
 * `GET /principal/me?f=permissions` for an administrator.
 *
 * `AccountBuilder` emits the principal's whole global permission set, so this
 * read is exhaustive: absence inside it is a real negative. `deferredPermissions`
 * is deliberately included and deliberately never read — it aggregates context
 * roles across every target and says nothing about one dataset.
 */
export const currentAdminAccountPayload = {
  permissions: [
    "BrowseDataset",
    "EditDataset",
    "DownloadDatasetFile",
    "AddUserToContextGrantGroup",
    "RemoveUserFromContextGrantGroup",
    "LookupContextGrantOther",
    "LookupDatasetContextGrants",
  ],
  deferredPermissions: ["DeleteDataset"],
};

/**
 * `GET /principal/me?f=permissions` for an ordinary manager: the dataset
 * capabilities they hold globally, and none of the access actions. What they
 * may do on one dataset comes from that dataset's projection.
 */
export const currentManagerAccountPayload = {
  permissions: ["BrowseDataset", "EditDataset", "DownloadDatasetFile"],
};

/**
 * `GET /dataset/{id}` as the **details page** projects it today: browse, edit
 * and download. This is the payload behind PM-01 finding F3 — it never asked
 * about granting, so it cannot answer that question either way.
 */
export const detailsPageDatasetPayload = {
  id: DATASET_ID,
  permissions: ["browsedataset", "editdataset", "downloaddatasetfile"],
};

/**
 * `GET /dataset/{id}?f=…` with the three action names projected, for a caller
 * whose affiliated context role carries grant and revoke but not the recipient
 * lookup. Because the lookup was requested, its absence is a real negative.
 */
export const datasetActionsGrantedPayload = {
  id: DATASET_ID,
  permissions: [
    "addusertocontextgrantgroup",
    "removeuserfromcontextgrantgroup",
  ],
};

/**
 * The same projection for a caller whose affiliated roles carry neither. The
 * empty array is a **complete** answer over the requested names, which is what
 * makes a negative conclusion possible at all.
 */
export const datasetActionsDeniedPayload = {
  id: DATASET_ID,
  permissions: [],
};

/**
 * The same projection for a caller with no affiliated context role on the
 * dataset at all. `DatasetBuilder` sets `Permissions` only when the dataset id
 * appears in the effective-roles map, so the field is simply absent — a state
 * the Gateway genuinely produces, and not the same as an empty array.
 */
export const datasetActionsAbsentPayload = {
  id: DATASET_ID,
};

/** `POST /user/group/query` projected with `id,name,semantics`. */
export const currentGroupQueryPayload = {
  items: [
    { id: EVERYONE_GROUP_ID, name: "Everyone", semantics: ["everyone"] },
    { id: RESEARCH_GROUP_ID, name: "Climate research", semantics: [] },
  ],
  count: 2,
};

/**
 * The same query where the `semantics` projection did not come back. Nothing
 * can be matched against, so the Everyone shortcut is unavailable for a reason
 * that is not "there is no Everyone group".
 */
export const groupQueryWithoutSemanticsPayload = {
  items: [
    { id: EVERYONE_GROUP_ID, name: "Everyone" },
    { id: RESEARCH_GROUP_ID, name: "Climate research" },
  ],
};

/** Two groups carrying the semantic: the ambiguity the spec requires refusing. */
export const ambiguousEveryoneGroupQueryPayload = {
  items: [
    { id: EVERYONE_GROUP_ID, name: "Everyone", semantics: ["everyone"] },
    { id: SECOND_GROUP_ID, name: "All users", semantics: ["everyone"] },
  ],
};

// ---------------------------------------------------------------------------
// Dataset-scoped recipient read (Gateway #98)
// ---------------------------------------------------------------------------
//
// `GET /principal/context-grants/dataset?id=<DATASET_ID>`, shaped from
// `PrincipalController.ContextGrantsDataset` and `DatasetContextGrants` at
// dg-app-api `71fb7dfa474041cede287a9733d3d14a3b5fabc0`: a direct list of
// `{ datasetId, users, userGroups }`, principals `{ id, roles }`, camelCase,
// nulls omitted. The group `id` is the Keycloak group id that
// `AAIKeycloakService.LookupDatasetContextGrants` takes from the principal
// group, the same id the write route resolves with `FindUserGroupPrincipalGroup`.
// That discovery returns the same id is a live check (task 6.1), not shown here.
//
// Synthetic, every one. An administrator and a dataset manager receive the
// same shape from the same route; which of them is *allowed* is a separate
// fact, carried by the capability fixtures, never by these payloads.

/** A user id, for the individual grants this group-only feature ignores. */
export const INDIVIDUAL_USER_ID = "e4d3c2b1-a098-4f76-8e54-3d2c1b0a9f8e";

/**
 * A group holding a role that group discovery does not return: the holder the
 * per-group read could never find, which the view must keep, read-only.
 */
export const UNDISCOVERED_GROUP_ID = "7a6b5c4d-3e2f-4a1b-9c0d-e1f2a3b4c5d6";

/**
 * A successful read: two discoverable groups, one with an Everyone Browse
 * grant, plus an individual user's grant that the feature does not turn into a
 * group row.
 */
export const datasetGrantsPayload = [
  {
    datasetId: DATASET_ID,
    users: [{ id: INDIVIDUAL_USER_ID, roles: ["dg_ds-edit"] }],
    userGroups: [
      { id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse", "dg_ds-download"] },
      { id: EVERYONE_GROUP_ID, roles: ["dg_ds-browse"] },
    ],
  },
];

/**
 * An explicit group-empty result. `LookupDatasetContextGrants` initializes both
 * lists empty for every requested dataset, so this is a real answer: no direct
 * group roles on this dataset — not "nobody has access".
 */
export const datasetGrantsEmptyPayload = [
  { datasetId: DATASET_ID, users: [], userGroups: [] },
];

/** A role this UI does not know, carried by a discoverable group. */
export const datasetGrantsUnknownRolePayload = [
  {
    datasetId: DATASET_ID,
    users: [],
    userGroups: [
      { id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse", "dg_ds-curate"] },
    ],
  },
];

/** A holder group discovery does not know, beside a discoverable one. */
export const datasetGrantsUndiscoveredHolderPayload = [
  {
    datasetId: DATASET_ID,
    users: [],
    userGroups: [
      { id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse"] },
      { id: UNDISCOVERED_GROUP_ID, roles: ["dg_ds-edit", "dg_ds-curate"] },
    ],
  },
];

/**
 * Responses that are not this dataset's inventory. Each must decode as a
 * failure, never as an empty list. The keys name the defect.
 */
export const datasetGrantsUnusablePayloads = {
  /** Empty at the dataset-list level: also what an empty-GUID request gets. */
  emptyList: [],
  otherDataset: [{ datasetId: OTHER_DATASET_ID, users: [], userGroups: [] }],
  duplicateDataset: [
    { datasetId: DATASET_ID, users: [], userGroups: [] },
    { datasetId: DATASET_ID, users: [], userGroups: [] },
  ],
  extraDataset: [
    { datasetId: DATASET_ID, users: [], userGroups: [] },
    { datasetId: OTHER_DATASET_ID, users: [], userGroups: [] },
  ],
  /** Newtonsoft omits a `null` list, so this is what a null arrives as. */
  groupsOmitted: [{ datasetId: DATASET_ID, users: [] }],
  groupsNull: [{ datasetId: DATASET_ID, users: [], userGroups: null }],
  datasetIdMissing: [{ users: [], userGroups: [] }],
  groupWithoutId: [
    { datasetId: DATASET_ID, userGroups: [{ roles: ["dg_ds-browse"] }] },
  ],
  rolesNotAList: [
    {
      datasetId: DATASET_ID,
      userGroups: [{ id: RESEARCH_GROUP_ID, roles: "dg_ds-browse" }],
    },
  ],
  rolesWithNonString: [
    {
      datasetId: DATASET_ID,
      userGroups: [{ id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse", 17] }],
    },
  ],
  notAList: { datasetId: DATASET_ID, userGroups: [] },
} as const;

/**
 * What the route returns when no requested dataset is eligible for the caller:
 * `ContextGrantsDataset` throws `DGForbiddenException` after the effective
 * lookup comes back empty. Whether a 403 is the confirmed restriction is
 * decided from capability evidence, never from the status alone.
 */
export const deniedRecipientReadStatus = 403;

/**
 * `GET /dataset/{id}?f=…` with the three action names projected, for a
 * dataset manager: `dg_ds-manage` carries grant, revoke and the dataset
 * recipient lookup through this dataset's context.
 */
export const datasetManagerActionsPayload = {
  id: DATASET_ID,
  permissions: [
    "addusertocontextgrantgroup",
    "removeuserfromcontextgrantgroup",
    "lookupdatasetcontextgrants",
  ],
};
