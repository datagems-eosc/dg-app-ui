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
  ],
  deferredPermissions: ["DeleteDataset"],
};

/**
 * `GET /principal/me?f=permissions` for an ordinary manager: the dataset
 * capabilities they hold globally, and none of the three access actions.
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
 * `GET /dataset/{id}?f=permissions.addUserToContextGrantGroup&f=permissions.removeUserFromContextGrantGroup`
 * for a caller whose affiliated context role carries both actions.
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

/**
 * `GET /principal/group/{groupId}/context-grants/dataset?id=…` as an
 * administrator sees it. Keyed by dataset; the roles are Gateway role
 * identifiers, not display labels.
 */
export const currentAdminGroupGrantsPayload = {
  [DATASET_ID]: ["dg_ds-browse", "dg_ds-download"],
  [OTHER_DATASET_ID]: ["dg_ds-browse"],
};

/**
 * The same read for a group with no roles on the requested dataset. The
 * resolver omits ids with no match, so the key is simply absent — over the
 * requested ids this is still a complete answer.
 */
export const currentAdminGroupGrantsEmptyPayload = {
  [OTHER_DATASET_ID]: ["dg_ds-browse"],
};

/**
 * What an **ordinary manager** gets from that same route: 403, because
 * `ContextGrantsDatasetGroupOther` calls `AuthorizeForce(LookupContextGrantOther)`
 * — a global permission, with no affiliated-context alternative. This is the
 * gate that keeps the full editor unavailable for ordinary managers, and it
 * must surface as "not supported", never as an empty recipient list.
 */
export const deniedManagerRecipientReadStatus = 403;
