/**
 * Dataset permissions — decoding the two group-shaped reads.
 *
 * Both decoders answer a narrow question and refuse to answer a wider one:
 *
 *  - {@link decodeUserGroups} decodes `POST /user/group/query`. What comes back
 *    is *the groups this caller may see*, which is not the deployment's group
 *    list and not an access inventory. A group appearing here says nothing
 *    about whether the caller may grant anything to it.
 *  - {@link decodeGroupDatasetGrants} decodes
 *    `GET /principal/group/{groupId}/context-grants/dataset?id=…`, which is
 *    keyed by dataset and returns role identifiers. It reports one group's
 *    roles on one dataset — never "who has access", because it is asked one
 *    group at a time and other paths to a dataset exist.
 *
 * Contract provenance, dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd`:
 * `UserController.Query` with `UserGroupBuilder` for the first, and
 * `PrincipalController.ContextGrantsDatasetGroupOther` — declared as
 * `Dictionary<String, HashSet<String>>` — for the second. Read from the local
 * source clone; no live response has been observed.
 */

import type { GroupRoleGrant, UserGroupRef } from "./types";

export type GroupsDecodeFailure =
  /** The payload was not a JSON object. */
  | "not-an-object"
  /** `items` was present but not an array. */
  | "items-not-an-array"
  /**
   * The dataset's entry was present but is not a usable list of roles: either
   * not an array at all, or an array carrying a member that is not a role
   * identifier. Both make the *whole* entry unusable — see
   * {@link decodeGroupDatasetGrants}.
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
 * Decode one group's roles on one dataset.
 *
 * The response is keyed by dataset id, so the caller must say which dataset it
 * asked about: picking "the only key" would silently accept an answer about a
 * different dataset.
 *
 * An absent key decodes to an empty role list rather than to a failure. At the
 * pinned Gateway `EffectiveContextRolesForDatasetOfUserGroup` builds its
 * dictionary from the group's grants filtered to the ids that were asked for
 * and omits ids with no match, so over the requested ids the response is a
 * complete answer and absence means "no roles for this group on this dataset".
 * Reporting that as a failed read would be its own untruth. What it still does
 * not mean is that nobody can reach the dataset: this is one group, and the
 * result is scoped by what the caller was allowed to ask.
 *
 * A **present** role array carrying a member that is not a role identifier is
 * the opposite case, and it is rejected rather than cleaned up. Filtering
 * `[null]` down to `[]`, or `["dg_ds-browse", 17]` down to one role, turns a
 * response we do not understand into complete recipient knowledge — and the
 * view draws complete knowledge as off switches, which is the claim "this group
 * does not hold that role". Nothing here supports that claim, so the read stays
 * malformed and the caller reports it as unavailable.
 *
 * An unrecognised but well-formed role string is *not* malformed: the Gateway
 * may add roles this UI does not know, and preserving them keeps that
 * forward-compatible. They simply match no control.
 */
export function decodeGroupDatasetGrants(
  payload: unknown,
  scope: { readonly groupId: string; readonly datasetId: string },
): DecodeResult<readonly GroupRoleGrant[]> {
  if (!isObject(payload)) return { ok: false, failure: "not-an-object" };

  const canonicalDatasetId = scope.datasetId.trim().toLowerCase();
  const key = Object.keys(payload).find(
    (candidate) => candidate.trim().toLowerCase() === canonicalDatasetId,
  );
  if (key === undefined) return { ok: true, value: [] };

  const roles = payload[key];
  if (!Array.isArray(roles)) {
    return { ok: false, failure: "malformed-roles" };
  }

  const grants: GroupRoleGrant[] = [];
  for (const member of roles) {
    if (!nonEmptyString(member)) {
      return { ok: false, failure: "malformed-roles" };
    }
    grants.push({ groupId: scope.groupId, role: member });
  }

  return { ok: true, value: grants };
}
