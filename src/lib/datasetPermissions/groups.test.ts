import { describe, expect, it } from "vitest";
import {
  ambiguousEveryoneGroupQueryPayload,
  currentGroupQueryPayload,
  DATASET_ID,
  datasetGrantsEmptyPayload,
  datasetGrantsPayload,
  datasetGrantsUndiscoveredHolderPayload,
  datasetGrantsUnknownRolePayload,
  datasetGrantsUnusablePayloads,
  EVERYONE_GROUP_ID,
  groupQueryWithoutSemanticsPayload,
  INDIVIDUAL_USER_ID,
  RESEARCH_GROUP_ID,
  UNDISCOVERED_GROUP_ID,
} from "./fixtures";
import { decodeDatasetGroupGrants, decodeUserGroups } from "./groups";
import { describeEveryoneDiscovery, findEveryoneGroup } from "./model";

describe("decodeUserGroups", () => {
  it("keeps id, name and semantics from the projected query", () => {
    const decoded = decodeUserGroups(currentGroupQueryPayload);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.value.groups).toEqual([
      { id: EVERYONE_GROUP_ID, name: "Everyone", semantics: ["everyone"] },
      { id: RESEARCH_GROUP_ID, name: "Climate research", semantics: [] },
    ]);
    expect(decoded.value.dropped).toBe(0);
  });

  it("distinguishes an absent semantics field from an empty one", () => {
    const decoded = decodeUserGroups(groupQueryWithoutSemanticsPayload);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    for (const group of decoded.value.groups) {
      expect(group.semantics).toBeUndefined();
    }

    // The difference has to survive into the explanation: a group *named*
    // Everyone with no semantics is not a match, and the reason is that
    // nothing was matched against, not that no such group exists.
    expect(
      describeEveryoneDiscovery({ kind: "read", groups: decoded.value.groups }),
    ).toEqual({ kind: "unavailable", reason: "semantics-unavailable" });
  });

  it("counts unusable items instead of silently shortening the list", () => {
    const decoded = decodeUserGroups({
      items: [
        { id: RESEARCH_GROUP_ID, name: "Climate research" },
        { name: "No id at all" },
        null,
        { id: "   " },
      ],
    });
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.value.groups).toHaveLength(1);
    // A non-zero count is what stops a caller reading "this group is not in
    // the list" as "this group does not exist".
    expect(decoded.value.dropped).toBe(3);
  });

  it("treats an absent items field as an empty visible list, not a failure", () => {
    const decoded = decodeUserGroups({ count: 0 });
    expect(decoded).toEqual({ ok: true, value: { groups: [], dropped: 0 } });
  });

  it("refuses a payload that is not a query result", () => {
    expect(decodeUserGroups(null)).toEqual({
      ok: false,
      failure: "not-an-object",
    });
    expect(decodeUserGroups([{ id: "g-1" }])).toEqual({
      ok: false,
      failure: "not-an-object",
    });
    expect(decodeUserGroups({ items: "nope" })).toEqual({
      ok: false,
      failure: "items-not-an-array",
    });
  });

  it("does not resolve Everyone when several groups carry the semantic", () => {
    const decoded = decodeUserGroups(ambiguousEveryoneGroupQueryPayload);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(findEveryoneGroup(decoded.value.groups)).toBeNull();
    expect(
      describeEveryoneDiscovery({ kind: "read", groups: decoded.value.groups }),
    ).toEqual({ kind: "unavailable", reason: "multiple-matches" });
  });
});

describe("decodeDatasetGroupGrants", () => {
  it("returns every group's roles for the requested dataset, ignoring users", () => {
    expect(decodeDatasetGroupGrants(datasetGrantsPayload, DATASET_ID)).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-download" },
        { groupId: EVERYONE_GROUP_ID, role: "dg_ds-browse" },
      ],
    });
  });

  it("never turns an individual user's grant into a group grant", () => {
    const decoded = decodeDatasetGroupGrants(datasetGrantsPayload, DATASET_ID);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(
      decoded.value.some((grant) => grant.groupId === INDIVIDUAL_USER_ID),
    ).toBe(false);
  });

  it("keeps an explicit empty group list as complete knowledge of no roles", () => {
    expect(
      decodeDatasetGroupGrants(datasetGrantsEmptyPayload, DATASET_ID),
    ).toEqual({ ok: true, value: [] });
  });

  it("keeps a holder discovery cannot see, by its exact id", () => {
    expect(
      decodeDatasetGroupGrants(
        datasetGrantsUndiscoveredHolderPayload,
        DATASET_ID,
      ),
    ).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: UNDISCOVERED_GROUP_ID, role: "dg_ds-edit" },
        { groupId: UNDISCOVERED_GROUP_ID, role: "dg_ds-curate" },
      ],
    });
  });

  it("preserves a well-formed role this UI does not recognise", () => {
    // The Gateway may add roles before this UI knows them. An unknown but
    // well-formed identifier is not malformed; it simply matches no control.
    expect(
      decodeDatasetGroupGrants(datasetGrantsUnknownRolePayload, DATASET_ID),
    ).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-curate" },
      ],
    });
  });

  it("merges repeated entries for one group and de-duplicates its roles", () => {
    const decoded = decodeDatasetGroupGrants(
      [
        {
          datasetId: DATASET_ID,
          userGroups: [
            { id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse"] },
            { id: EVERYONE_GROUP_ID, roles: ["dg_ds-browse"] },
            { id: RESEARCH_GROUP_ID, roles: ["DG_DS-BROWSE", "dg_ds-edit"] },
          ],
        },
      ],
      DATASET_ID,
    );
    expect(decoded).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-edit" },
        { groupId: EVERYONE_GROUP_ID, role: "dg_ds-browse" },
      ],
    });
  });

  it("joins group ids exactly, never folding case or trimming them", () => {
    // A group id is an identity the mutation route must receive unchanged; two
    // spellings are two groups as far as this UI may assume.
    const decoded = decodeDatasetGroupGrants(
      [
        {
          datasetId: DATASET_ID,
          userGroups: [
            { id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse"] },
            { id: RESEARCH_GROUP_ID.toUpperCase(), roles: ["dg_ds-edit"] },
          ],
        },
      ],
      DATASET_ID,
    );
    expect(decoded).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID.toUpperCase(), role: "dg_ds-edit" },
      ],
    });
  });

  it("matches the dataset GUID without regard to case", () => {
    expect(
      decodeDatasetGroupGrants(
        [{ datasetId: DATASET_ID.toUpperCase(), userGroups: [] }],
        DATASET_ID,
      ),
    ).toEqual({ ok: true, value: [] });
  });

  // Each of these is "not this dataset's inventory". Reading any of them as an
  // empty list would draw every group as holding nothing.
  it.each([
    ["an empty dataset list", "emptyList", "dataset-not-matched"],
    ["another dataset's entry", "otherDataset", "dataset-not-matched"],
    ["a duplicated dataset entry", "duplicateDataset", "dataset-not-matched"],
    ["an extra dataset beside it", "extraDataset", "dataset-not-matched"],
    ["no dataset id", "datasetIdMissing", "dataset-not-matched"],
    ["an omitted group list", "groupsOmitted", "groups-missing"],
    ["a null group list", "groupsNull", "groups-missing"],
    ["a group without an id", "groupWithoutId", "malformed-group"],
    ["roles that are not a list", "rolesNotAList", "malformed-roles"],
    ["a role that is not a string", "rolesWithNonString", "malformed-roles"],
    ["an object instead of a list", "notAList", "not-a-list"],
  ] as const)("refuses %s", (_label, key, failure) => {
    expect(
      decodeDatasetGroupGrants(datasetGrantsUnusablePayloads[key], DATASET_ID),
    ).toEqual({ ok: false, failure });
  });

  // PM-C1 R3, carried over. Filtering an unusable member out of a present
  // array turns a response we do not understand into *complete* recipient
  // knowledge, which the view draws as off switches — the claim "this group
  // does not hold that role". Nothing supports that claim.
  it.each([
    ["a null member", [null]],
    ["an object member", [{ role: "dg_ds-browse" }]],
    ["an empty string", [""]],
    ["a blank string", ["   "]],
    ["a nested array", [["dg_ds-browse"]]],
  ])("refuses a role array carrying %s", (_label, roles) => {
    expect(
      decodeDatasetGroupGrants(
        [
          {
            datasetId: DATASET_ID,
            userGroups: [{ id: RESEARCH_GROUP_ID, roles }],
          },
        ],
        DATASET_ID,
      ),
    ).toEqual({ ok: false, failure: "malformed-roles" });
  });

  it("refuses a blank group id rather than dropping that entry", () => {
    expect(
      decodeDatasetGroupGrants(
        [
          {
            datasetId: DATASET_ID,
            userGroups: [
              { id: RESEARCH_GROUP_ID, roles: ["dg_ds-browse"] },
              { id: "  ", roles: ["dg_ds-edit"] },
            ],
          },
        ],
        DATASET_ID,
      ),
    ).toEqual({ ok: false, failure: "malformed-group" });
  });

  it("ignores a malformed users list: individual grants are not read", () => {
    expect(
      decodeDatasetGroupGrants(
        [{ datasetId: DATASET_ID, users: "not-a-list", userGroups: [] }],
        DATASET_ID,
      ),
    ).toEqual({ ok: true, value: [] });
  });
});
