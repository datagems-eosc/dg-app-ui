/**
 * Dataset permissions — decoding the two group-shaped reads.
 *
 * Both decoders answer a narrow question and refuse to answer a wider one:
 *
 *  - {@link decodeUserGroups} decodes `POST /user/group/query`. What comes back
 *    is *the groups this caller may see*, which is not the deployment's group
 *    list and not an access inventory. A group appearing here says nothing
 *    about whether the caller may grant anything to it.
 *  - {@link decodeDatasetGroupGrants} decodes
 *    `GET /principal/context-grants/dataset?id=…` for one dataset. It reports
 *    which groups hold which direct roles on that dataset — never "who has
 *    access", because individual users and other paths are outside it.
 *
 * Contract provenance: `UserController.Query` with `UserGroupBuilder` at
 * dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd` for the first, and
 * `PrincipalController.ContextGrantsDataset` at
 * `71fb7dfa474041cede287a9733d3d14a3b5fabc0` for the second. Read from source;
 * no live response has been observed.
 */

import type { GroupRoleGrant, UserGroupRef } from "./types";

export type GroupsDecodeFailure =
  /** The payload was not a JSON object. */
  | "not-an-object"
  /** `items` was present but not an array. */
  | "items-not-an-array"
  /** The dataset inventory was not a JSON array. */
  | "not-a-list"
  /**
   * The inventory did not hold exactly one entry for the requested dataset:
   * none, several, a duplicate, or another dataset's.
   */
  | "dataset-not-matched"
  /** The dataset's `userGroups` was absent, `null` or not an array. */
  | "groups-missing"
  /** A group entry was not an object or carried no usable `id`. */
  | "malformed-group"
  /**
   * A group's `roles` was not an array, or carried a member that is not a
   * role identifier. Either makes the *whole* read unusable — see
   * {@link decodeDatasetGroupGrants}.
   */
  | "malformed-roles";

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: GroupsDecodeFailure };

/**
 * The field set the group query must project. `semantics` is the only way to
 * identify the Everyone audience; `name` is display only and `id` is what every
 * later request uses.
 */
export const GROUP_PROJECTION = ["id", "name", "semantics"] as const;

export interface DecodedUserGroups {
  readonly groups: readonly UserGroupRef[];
  /**
   * Items dropped because they carried no usable `id`. Surfaced rather than
   * swallowed: a non-zero count means the returned list is incomplete, so
   * "this group is not here" is not evidence that it does not exist.
   */
  readonly dropped: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const canonicalId = (value: string): string => value.trim().toLowerCase();

/**
 * `semantics` is deliberately left `undefined` when the field is absent and
 * `[]` when it came back empty. Those are different situations — a dropped
 * projection versus a group that carries no semantics — and
 * `describeEveryoneDiscovery` explains them differently.
 */
const decodeSemantics = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter(nonEmptyString);
};

export function decodeUserGroups(
  payload: unknown,
): DecodeResult<DecodedUserGroups> {
  if (!isObject(payload)) return { ok: false, failure: "not-an-object" };

  const items = payload.items;
  if (items === undefined || items === null) {
    return { ok: true, value: { groups: [], dropped: 0 } };
  }
  if (!Array.isArray(items)) {
    return { ok: false, failure: "items-not-an-array" };
  }

  const groups: UserGroupRef[] = [];
  let dropped = 0;

  for (const item of items) {
    if (!isObject(item) || !nonEmptyString(item.id)) {
      dropped += 1;
      continue;
    }
    const semantics = decodeSemantics(item.semantics);
    groups.push({
      id: item.id,
      ...(nonEmptyString(item.name) ? { name: item.name } : {}),
      ...(semantics === undefined ? {} : { semantics }),
    });
  }

  return { ok: true, value: { groups, dropped } };
}

/**
 * Decode `GET /principal/context-grants/dataset?id=<datasetId>` for the one
 * dataset that was asked about.
 *
 * Contract, dg-app-api `71fb7dfa474041cede287a9733d3d14a3b5fabc0`:
 * `PrincipalController.ContextGrantsDataset` returns
 * `List<DatasetContextGrants>` — `{ datasetId, users, userGroups }`, each
 * principal `{ id, roles }` — serialized camelCase by Newtonsoft with nulls
 * omitted. `AAIKeycloakService.LookupDatasetContextGrants` initializes both
 * principal lists as empty for every requested dataset, so a present empty
 * `userGroups` is a real answer, and a missing or `null` one is not.
 *
 * The rules, each of which refuses rather than guesses:
 *
 *  - **exactly one result, for the requested dataset.** An empty list, a
 *    second entry, a duplicate or another dataset's entry is not this
 *    dataset's inventory. The Gateway can omit an ineligible dataset from a
 *    multi-id request, so omission is never "no grants";
 *  - **`userGroups` must be an array.** Absent or `null` cannot be told apart
 *    from a dropped field, and drawing it as empty would claim nobody holds a
 *    role;
 *  - **every group entry must be usable.** A non-object, a blank `id` or a
 *    `roles` value that is not an array of non-blank strings fails the whole
 *    read. Dropping the bad entry would quietly shorten a list the view
 *    presents as complete;
 *  - **group ids are kept exactly as returned.** They are joined to discovery
 *    and to the mutation route by identity, never by display name;
 *  - **repeated entries for one group merge**, and its roles are de-duplicated
 *    ignoring case, which is how the Gateway compares role identifiers;
 *  - **unknown well-formed roles survive.** The Gateway may add roles this UI
 *    does not know; they are shown, never mapped to a control;
 *  - **`users` is not read.** Individual grants are outside this group-only
 *    feature, so they are neither validated nor turned into group rows.
 *
 * The dataset id is a GUID on both sides, so it is compared without regard to
 * case or surrounding space; that is the same identity, not a looser match.
 */
export function decodeDatasetGroupGrants(
  payload: unknown,
  datasetId: string,
): DecodeResult<readonly GroupRoleGrant[]> {
  if (!Array.isArray(payload)) return { ok: false, failure: "not-a-list" };
  if (payload.length !== 1) {
    return { ok: false, failure: "dataset-not-matched" };
  }

  const entry = payload[0];
  if (!isObject(entry)) return { ok: false, failure: "dataset-not-matched" };
  const returnedId = entry.datasetId;
  if (
    !nonEmptyString(returnedId) ||
    canonicalId(returnedId) !== canonicalId(datasetId)
  ) {
    return { ok: false, failure: "dataset-not-matched" };
  }

  const groups = entry.userGroups;
  if (!Array.isArray(groups)) return { ok: false, failure: "groups-missing" };

  // Insertion-ordered: the first time a group id appears fixes its position.
  const rolesByGroup = new Map<string, Map<string, string>>();
  for (const group of groups) {
    if (!isObject(group) || !nonEmptyString(group.id)) {
      return { ok: false, failure: "malformed-group" };
    }
    if (!Array.isArray(group.roles)) {
      return { ok: false, failure: "malformed-roles" };
    }
    const roles = rolesByGroup.get(group.id) ?? new Map<string, string>();
    for (const role of group.roles) {
      if (!nonEmptyString(role)) {
        return { ok: false, failure: "malformed-roles" };
      }
      const key = role.trim().toLowerCase();
      if (!roles.has(key)) roles.set(key, role);
    }
    rolesByGroup.set(group.id, roles);
  }

  const grants: GroupRoleGrant[] = [];
  for (const [groupId, roles] of rolesByGroup) {
    for (const role of roles.values()) grants.push({ groupId, role });
  }
  return { ok: true, value: grants };
}
