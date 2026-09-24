/**
 * Synthetic identities, groups and datasets for the dataset-permissions
 * browser journey. None of these exist anywhere: the Gateway origin is a
 * reserved `.invalid` host and every id is made up.
 */

export const GATEWAY = "https://gateway.synthetic.invalid";

export const DATASET = {
  id: "7b3e1d2c-5a4f-4c6b-9e8d-1f2a3b4c5d6e",
  name: "Synthetic Salinity Profiles",
};

export const ACCOUNT_A = {
  id: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  name: "Synthetic Manager A",
  email: "manager-a@example.invalid",
  token: "synthetic-token-a",
};

export const ACCOUNT_B = {
  id: "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4",
  name: "Synthetic Manager B",
  email: "manager-b@example.invalid",
  token: "synthetic-token-b",
};

export const GRANT = "AddUserToContextGrantGroup";
export const REVOKE = "RemoveUserFromContextGrantGroup";
export const LOOKUP = "LookupContextGrantOther";

/** Full editor: recipient lookup plus both write capabilities. */
export const FULL_EDITOR = [GRANT, REVOKE, LOOKUP];
/** Grant-only: grant capability with the lookup restriction. */
export const GRANT_ONLY = [GRANT];
/** Read-only: lookup without either write capability. */
export const READ_ONLY = [LOOKUP];

export const EVERYONE = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  name: "Everyone",
  semantics: ["everyone"],
};
export const RESEARCH = {
  id: "5f6e7d8c-9b0a-41c2-83d4-e5f6a7b8c9d0",
  name: "Research Team",
  semantics: [],
};
export const MARINE = {
  id: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
  name: "Marine Survey Group",
  semantics: [],
};
export const PUBLIC_A = {
  id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  name: "Public A",
  semantics: ["everyone"],
};
export const PUBLIC_B = {
  id: "3e4d5c6b-7a89-4b0c-9d1e-2f3a4b5c6d7e",
  name: "Public B",
  semantics: ["everyone"],
};

export const STANDARD_GROUPS = [EVERYONE, RESEARCH, MARINE];
export const AMBIGUOUS_GROUPS = [PUBLIC_A, PUBLIC_B, RESEARCH];

export const ROLE_LABELS = [
  "Browse",
  "Search",
  "Download",
  "Edit",
  "Manage",
  "Delete",
];

/** The caller's own context grant, which lists the dataset in settings. */
export const selfManageGrant = (account) => [
  {
    principalId: account.id,
    principalType: 0,
    targetType: 0,
    targetId: DATASET.id,
    role: "dg_ds-manage",
  },
];

/** The caller's dataset permissions as the details read reports them. */
export const DETAILS_PERMISSIONS = {
  known: ["browsedataset", "editdataset"],
  empty: [],
  missing: undefined,
};
