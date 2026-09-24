import { describe, expect, it } from "vitest";
import {
  ambiguousEveryoneGroupQueryPayload,
  currentAdminGroupGrantsEmptyPayload,
  currentAdminGroupGrantsPayload,
  currentGroupQueryPayload,
  DATASET_ID,
  EVERYONE_GROUP_ID,
  groupQueryWithoutSemanticsPayload,
  OTHER_DATASET_ID,
  RESEARCH_GROUP_ID,
} from "./fixtures";
import { decodeGroupDatasetGrants, decodeUserGroups } from "./groups";
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

describe("decodeGroupDatasetGrants", () => {
  it("returns only the requested dataset's roles, bound to the group asked about", () => {
    const decoded = decodeGroupDatasetGrants(currentAdminGroupGrantsPayload, {
      groupId: RESEARCH_GROUP_ID,
      datasetId: DATASET_ID,
    });

    expect(decoded).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-download" },
      ],
    });
  });

  it("does not answer with another dataset's roles", () => {
    // The response is keyed by dataset. Taking "the only key" would quietly
    // report a different dataset's grants for this one.
    const decoded = decodeGroupDatasetGrants(
      { [OTHER_DATASET_ID]: ["dg_ds-manage"] },
      { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
    );
    expect(decoded).toEqual({ ok: true, value: [] });
  });

  it("reads an omitted dataset key as no roles for that group", () => {
    const decoded = decodeGroupDatasetGrants(
      currentAdminGroupGrantsEmptyPayload,
      { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
    );
    expect(decoded).toEqual({ ok: true, value: [] });
  });

  it("matches the dataset key case-insensitively", () => {
    const decoded = decodeGroupDatasetGrants(
      { [DATASET_ID.toUpperCase()]: ["dg_ds-browse"] },
      { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
    );
    expect(decoded).toEqual({
      ok: true,
      value: [{ groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" }],
    });
  });

  it("refuses a malformed roles entry rather than reporting no roles", () => {
    expect(
      decodeGroupDatasetGrants(
        { [DATASET_ID]: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
      ),
    ).toEqual({ ok: false, failure: "malformed-roles" });

    expect(
      decodeGroupDatasetGrants(null, {
        groupId: RESEARCH_GROUP_ID,
        datasetId: DATASET_ID,
      }),
    ).toEqual({ ok: false, failure: "not-an-object" });
  });

  // PM-C1 R3. Filtering an unusable member out of a present array turns a
  // response we do not understand into *complete* recipient knowledge, which
  // the view is entitled to draw as off switches — the claim "this group does
  // not hold that role". Nothing supports that claim, so the read is malformed.
  it.each([
    ["a null member", [null]],
    ["a numeric member", ["dg_ds-browse", 17]],
    ["an object member", [{ role: "dg_ds-browse" }]],
    ["an empty string", [""]],
    ["a blank string", ["   "]],
    ["a nested array", [["dg_ds-browse"]]],
  ])("refuses a role array carrying %s", (_label, roles) => {
    expect(
      decodeGroupDatasetGrants(
        { [DATASET_ID]: roles },
        { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
      ),
    ).toEqual({ ok: false, failure: "malformed-roles" });
  });

  it("keeps a valid empty array as complete knowledge of no roles", () => {
    // The contract's own "this group holds nothing here" answer, and the
    // boundary the rule above must not swallow.
    expect(
      decodeGroupDatasetGrants(
        { [DATASET_ID]: [] },
        { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
      ),
    ).toEqual({ ok: true, value: [] });
  });

  it("preserves a well-formed role this UI does not recognise", () => {
    // The Gateway may add roles before this UI knows them. An unknown but
    // well-formed identifier is not malformed; it simply matches no control.
    expect(
      decodeGroupDatasetGrants(
        { [DATASET_ID]: ["dg_ds-browse", "dg_ds-future"] },
        { groupId: RESEARCH_GROUP_ID, datasetId: DATASET_ID },
      ),
    ).toEqual({
      ok: true,
      value: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-future" },
      ],
    });
  });
});
