export type PermissionKey =
  | "browse"
  | "delete"
  | "download"
  | "edit"
  | "manage"
  | "search";

const DATASET_ROLE_PREFIX = "dg_ds-";
const COLLECTION_ROLE_PREFIX = "dg_col-";

export const DATASET_ROLE_MAP: Record<PermissionKey, string> = {
  browse: `${DATASET_ROLE_PREFIX}browse`,
  delete: `${DATASET_ROLE_PREFIX}delete`,
  download: `${DATASET_ROLE_PREFIX}download`,
  edit: `${DATASET_ROLE_PREFIX}edit`,
  manage: `${DATASET_ROLE_PREFIX}manage`,
  search: `${DATASET_ROLE_PREFIX}search`,
};

export const COLLECTION_ROLE_MAP: Record<PermissionKey, string> = {
  browse: `${COLLECTION_ROLE_PREFIX}browse`,
  delete: `${COLLECTION_ROLE_PREFIX}delete`,
  download: `${COLLECTION_ROLE_PREFIX}download`,
  edit: `${COLLECTION_ROLE_PREFIX}edit`,
  manage: `${COLLECTION_ROLE_PREFIX}manage`,
  search: `${COLLECTION_ROLE_PREFIX}search`,
};

export const mapRolesToPermissions = (
  roles: string[],
  roleMap: Record<PermissionKey, string>,
) => {
  const normalized = new Set(roles.map((role) => role.toLowerCase()));
  return (Object.keys(roleMap) as PermissionKey[]).reduce(
    (acc, key) => {
      acc[key] = normalized.has(roleMap[key].toLowerCase());
      return acc;
    },
    {} as Record<PermissionKey, boolean>,
  );
};
