/**
 * Fixtures for the **candidate capability contract**.
 *
 * The candidate is this: a caller may grant or revoke when the exact Gateway
 * permission name appears either in their global permission set or in the
 * dataset-scoped projection for that one dataset. It is read from
 * `AuthorizationService.AuthorizeOrAffiliatedContextForce`, which authorizes by
 * global **or** affiliated-context policy.
 *
 * That is source-supported inference. It is **not** a partner answer, not a
 * deployed observation and not an approved contract: PM-05 owns confirming the
 * supported projection and combination, including whether an administrator's
 * global success is the only path that works in practice. These fixtures
 * exercise the model's rule; they do not evidence it.
 *
 * Nothing here may be used to argue that an ordinary manager can grant.
 */

import { DATASET_ID } from "./current";

/**
 * Global set carries neither action; the dataset projection carries both. The
 * candidate says this authorizes — through the affiliated-context half of the
 * rule, never through a role label such as `dg_ds-manage`.
 */
export const candidateContextOnlyEvidence = {
  accountPayload: { permissions: ["BrowseDataset", "EditDataset"] },
  datasetPayload: {
    id: DATASET_ID,
    permissions: [
      "addusertocontextgrantgroup",
      "removeuserfromcontextgrantgroup",
    ],
  },
};

/**
 * Global set carries both actions; the dataset projection carries neither. The
 * candidate says this authorizes through the global half — the administrator
 * case, and the one whose success proves nothing about anyone else.
 */
export const candidateGlobalOnlyEvidence = {
  accountPayload: {
    permissions: [
      "AddUserToContextGrantGroup",
      "RemoveUserFromContextGrantGroup",
    ],
  },
  datasetPayload: { id: DATASET_ID, permissions: [] },
};

/**
 * Grant is held, revoke is not. Each action is decided separately: an editor
 * that enabled revocation from a positive grant evidence would be inventing
 * authority the Gateway never conceded.
 */
export const candidateAsymmetricEvidence = {
  accountPayload: { permissions: ["AddUserToContextGrantGroup"] },
  datasetPayload: { id: DATASET_ID, permissions: [] },
};

/**
 * Neither source is positive and one of them never completed. Under the
 * candidate this is `unknown`, not `not-permitted`: "absence is definitive only
 * after all necessary, complete reads".
 */
export const candidateIncompleteEvidence = {
  /** The account read failed; only the dataset projection came back. */
  datasetPayload: { id: DATASET_ID, permissions: [] },
};
