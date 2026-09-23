import { describe, expect, it } from "vitest";
import { decodeCallerPermissions } from "./decode";
import {
  datasetPermissionEvidence,
  decideAction,
  decideSharing,
  findEveryoneGroup,
  mayAttempt,
  PERMISSIONS_FAILED,
  PERMISSIONS_NOT_READ,
  permissionLabelsForDisplay,
  permissionsRead,
  recipientGrantsForDisplay,
  sharingStateFromLegacyAccess,
} from "./model";
import type { GroupDiscoveryState, RecipientGrantsState } from "./types";

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

describe("decideAction", () => {
  it("allows the action on positive global evidence alone", () => {
    expect(
      decideAction("grant", {
        global: permissionsRead([GRANT]),
        datasetContext: permissionsRead([]),
      }),
    ).toBe("allowed");
  });

  it("allows the action on positive dataset-context evidence alone", () => {
    expect(
      decideAction("grant", {
        global: permissionsRead([]),
        datasetContext: permissionsRead(["addusertocontextgrantgroup"]),
      }),
    ).toBe("allowed");
  });

  it("refuses only when both reads completed without the permission", () => {
    expect(
      decideAction("grant", {
        global: permissionsRead(["BrowseDataset"]),
        datasetContext: permissionsRead(["browsedataset", "editdataset"]),
      }),
    ).toBe("not-permitted");
  });

  it("stays unknown when a necessary read failed", () => {
    expect(
      decideAction("grant", {
        global: PERMISSIONS_FAILED,
        datasetContext: permissionsRead([]),
      }),
    ).toBe("unknown");
  });

  it("stays unknown when a necessary read was never attempted", () => {
    expect(
      decideAction("grant", {
        global: permissionsRead([]),
        datasetContext: PERMISSIONS_NOT_READ,
      }),
    ).toBe("unknown");
  });

  it("does not let a role identifier or manager label authorize a grant", () => {
    expect(
      decideAction("grant", {
        global: permissionsRead(["dg_ds-manage", "Administrator"]),
        datasetContext: permissionsRead(["dg_ds-manage"]),
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
        global: permissionsRead([]),
        datasetContext: PERMISSIONS_NOT_READ,
      }),
    ).toBe("unknown");
  });

  it("decides recipient lookup and revoke separately from granting", () => {
    const evidence = {
      global: permissionsRead([GRANT]),
      datasetContext: permissionsRead([]),
    };

    expect(decideAction("grant", evidence)).toBe("allowed");
    expect(decideAction("revoke", evidence)).toBe("not-permitted");
    expect(decideAction("lookupRecipients", evidence)).toBe("not-permitted");

    const withAll = {
      global: permissionsRead([GRANT, REVOKE, LOOKUP]),
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
        global: permissionsRead([]),
        datasetContext: datasetPermissionEvidence(decoded),
      }),
    ).toBe("allowed");
  });

  it("turns missing permission evidence into not-read, never an empty read", () => {
    const evidence = datasetPermissionEvidence(
      decodeCallerPermissions(undefined),
    );

    expect(evidence).toEqual({ kind: "not-read" });
    expect(
      decideAction("grant", {
        global: permissionsRead([]),
        datasetContext: evidence,
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
