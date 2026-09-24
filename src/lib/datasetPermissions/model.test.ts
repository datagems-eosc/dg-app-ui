import { describe, expect, it } from "vitest";
import { decodeCallerPermissions } from "./decode";
import {
  datasetPermissionEvidence,
  decideAction,
  decideSharing,
  describeEveryoneDiscovery,
  exhaustivePermissionsRead,
  findEveryoneGroup,
  mayAttempt,
  PERMISSIONS_FAILED,
  PERMISSIONS_NOT_READ,
  permissionLabelsForDisplay,
  projectedPermissionsRead,
  recipientGrantsForDisplay,
  sharingStateFromLegacyAccess,
} from "./model";
import type {
  GroupDiscoveryState,
  RecipientGrantsState,
  UserGroupRef,
} from "./types";

/**
 * Fixture provenance: permission and role spellings come from dg-app-api
 * `8988a7e879a2239b85dcb4a7f4ce932e368674fd`
 * (`Authorization/Permission.cs`, `Api/Authorization/AuthorizationService`).
 * The global-or-context combination they are used to exercise is a candidate
 * contract read from that source; it is not a deployed observation and no live
 * call is made anywhere in these tests.
 */

const GRANT = "AddUserToContextGrantGroup";
const REVOKE = "RemoveUserFromContextGrantGroup";
const LOOKUP = "LookupContextGrantOther";

/** What the adapter's dataset projection asks for. See `gateway.ts`. */
const ACTION_PROJECTION = [GRANT, REVOKE];

/** A completed dataset-scoped read of the two action names. */
const datasetActions = (names: readonly string[]) =>
  projectedPermissionsRead(names, ACTION_PROJECTION);

describe("decideAction", () => {
  it("allows the action on positive global evidence alone", () => {
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([GRANT]),
        datasetContext: datasetActions([]),
      }),
    ).toBe("allowed");
  });

  it("allows the action on positive dataset-context evidence alone", () => {
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([]),
        datasetContext: datasetActions(["addusertocontextgrantgroup"]),
      }),
    ).toBe("allowed");
  });

  it("refuses only when both reads completed and covered the name", () => {
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead(["BrowseDataset"]),
        datasetContext: datasetActions([]),
      }),
    ).toBe("not-permitted");
  });

  it("stays unknown when a necessary read failed", () => {
    expect(
      decideAction("grant", {
        global: PERMISSIONS_FAILED,
        datasetContext: datasetActions([]),
      }),
    ).toBe("unknown");
  });

  it("stays unknown when a necessary read was never attempted", () => {
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([]),
        datasetContext: PERMISSIONS_NOT_READ,
      }),
    ).toBe("unknown");
  });

  it("does not let a role identifier or manager label authorize a grant", () => {
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead(["dg_ds-manage", "Administrator"]),
        datasetContext: datasetActions(["dg_ds-manage"]),
      }),
    ).toBe("not-permitted");
  });

  it("does not let aggregate deferred permissions authorize a grant", () => {
    // `deferredPermissions` aggregates context roles across every target, so
    // even a set that literally contains the grant name is evidence about some
    // other target. It must never be passed as this dataset's evidence; when
    // the dataset read is what is actually missing, the answer is unknown.
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([]),
        datasetContext: PERMISSIONS_NOT_READ,
      }),
    ).toBe("unknown");
  });

  it("decides recipient lookup and revoke separately from granting", () => {
    const evidence = {
      global: exhaustivePermissionsRead([GRANT]),
      datasetContext: datasetActions([]),
    };

    expect(decideAction("grant", evidence)).toBe("allowed");
    expect(decideAction("revoke", evidence)).toBe("not-permitted");
    // The dataset projection never asks about the lookup permission — it is
    // checked globally with no affiliated-context alternative — so an
    // exhaustive global read is on its own enough to settle it.
    expect(decideAction("lookupRecipients", evidence)).toBe("not-permitted");

    const withAll = {
      global: exhaustivePermissionsRead([GRANT, REVOKE, LOOKUP]),
      datasetContext: PERMISSIONS_NOT_READ,
    };
    expect(decideAction("revoke", withAll)).toBe("allowed");
    expect(decideAction("lookupRecipients", withAll)).toBe("allowed");
  });

  it("only allows a mutation attempt on an explicit allowed decision", () => {
    expect(mayAttempt("allowed")).toBe(true);
    expect(mayAttempt("unknown")).toBe(false);
    expect(mayAttempt("not-permitted")).toBe(false);
  });
});

describe("datasetPermissionEvidence", () => {
  it("carries every returned name, including ones that are not capabilities", () => {
    const decoded = decodeCallerPermissions([
      "browsedataset",
      "addusertocontextgrantgroup",
    ]);

    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([]),
        datasetContext: datasetPermissionEvidence(decoded, ACTION_PROJECTION),
      }),
    ).toBe("allowed");
  });

  it("turns missing permission evidence into not-read, never an empty read", () => {
    const evidence = datasetPermissionEvidence(
      decodeCallerPermissions(undefined),
      ACTION_PROJECTION,
    );

    expect(evidence).toEqual({ kind: "not-read" });
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([]),
        datasetContext: evidence,
      }),
    ).toBe("unknown");
  });

  /**
   * PM-01 finding F3. Before coverage was carried, this returned
   * `not-permitted`: `decideAction` saw two completed reads and concluded a
   * negative about a name the dataset read had never asked for. The details
   * page projects browse, edit and download, so its decoded result is silent
   * about granting — and silence is not denial.
   */
  it("does not let an unrequested name become a refusal (F3)", () => {
    const detailsPageProjection = [
      "BrowseDataset",
      "EditDataset",
      "DownloadDatasetFile",
    ];
    const detailsPageResult = datasetPermissionEvidence(
      decodeCallerPermissions(
        detailsPageProjection.map((name) => name.toLowerCase()),
      ),
      detailsPageProjection,
    );

    expect(
      decideAction("grant", {
        global: PERMISSIONS_NOT_READ,
        datasetContext: detailsPageResult,
      }),
    ).toBe("unknown");

    // Even beside a completed global read, the dataset half stays silent, so
    // the pair cannot support a negative.
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead(["BrowseDataset"]),
        datasetContext: detailsPageResult,
      }),
    ).toBe("unknown");

    // ...and the one thing that must never change direction: an explicit
    // positive is still usable, whichever half supplies it.
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([GRANT]),
        datasetContext: detailsPageResult,
      }),
    ).toBe("allowed");
  });

  it("keeps a partial projection partial: one name answered, the other not", () => {
    const grantOnly = datasetPermissionEvidence(decodeCallerPermissions([]), [
      GRANT,
    ]);

    // Grant was asked about and did not come back: a real negative, once the
    // global half is also complete.
    expect(
      decideAction("grant", {
        global: exhaustivePermissionsRead([]),
        datasetContext: grantOnly,
      }),
    ).toBe("not-permitted");

    // Revoke was never asked about, so the same evidence says nothing at all.
    expect(
      decideAction("revoke", {
        global: PERMISSIONS_NOT_READ,
        datasetContext: grantOnly,
      }),
    ).toBe("unknown");
  });
});

describe("recipientGrantsForDisplay", () => {
  it("returns the grants of a completed read", () => {
    const state: RecipientGrantsState = {
      kind: "known",
      grants: [{ groupId: "g-1", role: "dg_ds-browse" }],
    };
    expect(recipientGrantsForDisplay(state)).toHaveLength(1);
  });

  it("returns null rather than an empty list for a failed read", () => {
    expect(recipientGrantsForDisplay({ kind: "failed" })).toBeNull();
  });

  it("returns null when the read is unsupported for this caller", () => {
    expect(
      recipientGrantsForDisplay({ kind: "unknown", reason: "not-supported" }),
    ).toBeNull();
  });

  it("keeps a completed empty read distinct from a failed one", () => {
    expect(recipientGrantsForDisplay({ kind: "known", grants: [] })).toEqual(
      [],
    );
  });
});

describe("findEveryoneGroup", () => {
  it("matches on the returned semantic, not on the display name", () => {
    const group = findEveryoneGroup([
      { id: "g-1", name: "Everyone", semantics: [] },
      { id: "g-2", name: "Public audience", semantics: ["everyone"] },
    ]);
    expect(group?.id).toBe("g-2");
  });

  it("is unavailable when no group carries the semantic", () => {
    expect(findEveryoneGroup([{ id: "g-1", name: "Everyone" }])).toBeNull();
  });

  it("is unavailable when several groups carry the semantic", () => {
    expect(
      findEveryoneGroup([
        { id: "g-1", semantics: ["everyone"] },
        { id: "g-2", semantics: ["Everyone"] },
      ]),
    ).toBeNull();
  });
});

describe("decideSharing", () => {
  const everyoneGroups: GroupDiscoveryState = {
    kind: "read",
    groups: [
      { id: "g-public", semantics: ["everyone"] },
      { id: "g-team", semantics: ["organisation"] },
    ],
  };

  it("reports public only on an Everyone browse grant", () => {
    expect(
      decideSharing(everyoneGroups, {
        kind: "known",
        grants: [{ groupId: "g-public", role: "dg_ds-browse" }],
      }),
    ).toEqual({ state: "public", reason: "everyone-browse-grant" });
  });

  it("reports restricted only after a complete read without that grant", () => {
    expect(
      decideSharing(everyoneGroups, {
        kind: "known",
        grants: [{ groupId: "g-team", role: "dg_ds-browse" }],
      }),
    ).toEqual({
      state: "restricted",
      reason: "complete-read-without-everyone-grant",
    });
  });

  it("does not treat another group's grant on the same dataset as publication", () => {
    expect(
      decideSharing(everyoneGroups, {
        kind: "known",
        grants: [{ groupId: "g-public", role: "dg_ds-edit" }],
      }).state,
    ).toBe("restricted");
  });

  it("stays unknown when the grant read failed", () => {
    expect(decideSharing(everyoneGroups, { kind: "failed" })).toEqual({
      state: "unknown",
      reason: "read-failed",
    });
  });

  it("stays unknown when nothing was read", () => {
    expect(
      decideSharing(
        { kind: "unknown" },
        { kind: "unknown", reason: "not-read" },
      ),
    ).toEqual({ state: "unknown", reason: "no-evidence" });
  });

  it("stays unknown when the Everyone group cannot be identified", () => {
    expect(
      decideSharing(
        {
          kind: "read",
          groups: [{ id: "g-team", semantics: ["organisation"] }],
        },
        { kind: "known", grants: [] },
      ),
    ).toEqual({ state: "unknown", reason: "ambiguous-everyone-group" });
  });
});

describe("permissionLabelsForDisplay", () => {
  it("returns product labels for a completed read", () => {
    expect(
      permissionLabelsForDisplay(
        decodeCallerPermissions(["browsedataset", "downloaddatasetfile"]),
      ),
    ).toEqual(["Browse", "Download"]);
  });

  it("returns an empty list for a completed read with nothing to display", () => {
    expect(permissionLabelsForDisplay(decodeCallerPermissions([]))).toEqual([]);
  });

  it("returns undefined when there was no readable evidence", () => {
    expect(
      permissionLabelsForDisplay(decodeCallerPermissions(undefined)),
    ).toBeUndefined();
  });
});

describe("sharingStateFromLegacyAccess", () => {
  it("maps the existing binary labels", () => {
    expect(sharingStateFromLegacyAccess("Open Access")).toBe("public");
    expect(sharingStateFromLegacyAccess("Restricted")).toBe("restricted");
  });

  it("maps a missing label to unknown rather than to restricted", () => {
    expect(sharingStateFromLegacyAccess(undefined)).toBe("unknown");
    expect(sharingStateFromLegacyAccess("")).toBe("unknown");
  });
});

describe("describeEveryoneDiscovery", () => {
  const groupsRead = (groups: UserGroupRef[]): GroupDiscoveryState => ({
    kind: "read",
    groups,
  });

  it("identifies the single group carrying the semantic", () => {
    const everyone = { id: "g-1", name: "Public", semantics: ["everyone"] };
    expect(
      describeEveryoneDiscovery(
        groupsRead([everyone, { id: "g-2", name: "Everyone", semantics: [] }]),
      ),
    ).toEqual({ kind: "identified", group: everyone });
  });

  it("separates several matches from none", () => {
    expect(
      describeEveryoneDiscovery(
        groupsRead([
          { id: "g-1", semantics: ["everyone"] },
          { id: "g-2", semantics: ["EVERYONE"] },
        ]),
      ),
    ).toEqual({ kind: "unavailable", reason: "multiple-matches" });

    expect(
      describeEveryoneDiscovery(groupsRead([{ id: "g-1", semantics: [] }])),
    ).toEqual({ kind: "unavailable", reason: "no-match" });
  });

  it("reports a dropped semantics projection as its own reason", () => {
    // A group named "Everyone" with no semantics field is not a match, and the
    // explanation has to say that nothing could be matched against — otherwise
    // an operator reads "no Everyone group exists" and goes looking for one.
    expect(
      describeEveryoneDiscovery(groupsRead([{ id: "g-1", name: "Everyone" }])),
    ).toEqual({ kind: "unavailable", reason: "semantics-unavailable" });
  });

  it("treats an empty visible group list as no match, not a dropped field", () => {
    expect(describeEveryoneDiscovery(groupsRead([]))).toEqual({
      kind: "unavailable",
      reason: "no-match",
    });
  });

  it("stays unknown when groups were not read", () => {
    expect(describeEveryoneDiscovery({ kind: "failed" })).toEqual({
      kind: "unavailable",
      reason: "groups-unknown",
    });
    expect(describeEveryoneDiscovery({ kind: "unknown" })).toEqual({
      kind: "unavailable",
      reason: "groups-unknown",
    });
  });
});
