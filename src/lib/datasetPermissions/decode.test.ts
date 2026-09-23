import { describe, expect, it } from "vitest";
import { decodeCallerPermissions } from "./decode";

/**
 * Fixture provenance: shapes are derived from dg-app-api
 * `8988a7e879a2239b85dcb4a7f4ce932e368674fd` —
 * `Model/Builder/DatasetBuilder.cs` projects the requested permission names and
 * `Common/Extensions.ReduceToAssignedPermissions` lower-cases them, so the
 * array entries below are lower case. The legacy boolean objects come from the
 * shape the existing UI tests and mock data use. No live capture was taken.
 */

describe("decodeCallerPermissions — actual Gateway array", () => {
  it("decodes a lower-cased permission array (the branch the page never reached)", () => {
    const decoded = decodeCallerPermissions([
      "browsedataset",
      "editdataset",
      "downloaddatasetfile",
    ]);

    expect(decoded).toMatchObject({
      kind: "read",
      source: "array",
      capabilities: ["browse", "edit", "download"],
    });
  });

  it("maps DownloadDatasetFile, and not the projection the page used to request", () => {
    expect(decodeCallerPermissions(["downloaddatasetfile"])).toMatchObject({
      capabilities: ["download"],
    });
    // `downloadDataset` is not a permission this Gateway revision declares.
    expect(decodeCallerPermissions(["downloaddataset"])).toMatchObject({
      capabilities: [],
      unrecognized: ["downloaddataset"],
    });
  });

  it("keeps an unrecognised name as evidence without turning it into a capability", () => {
    const decoded = decodeCallerPermissions([
      "browsedataset",
      "addusertocontextgrantgroup",
    ]);

    expect(decoded).toMatchObject({
      kind: "read",
      capabilities: ["browse"],
      unrecognized: ["addusertocontextgrantgroup"],
      names: ["browsedataset", "addusertocontextgrantgroup"],
    });
  });

  it("treats an empty array as a complete answer, not as missing evidence", () => {
    expect(decodeCallerPermissions([])).toMatchObject({
      kind: "read",
      capabilities: [],
    });
  });

  it("does not invent a capability from a role identifier", () => {
    expect(decodeCallerPermissions(["dg_ds-manage"])).toMatchObject({
      kind: "read",
      capabilities: [],
      unrecognized: ["dg_ds-manage"],
    });
  });

  it("reports an array of uninterpretable entries as absent", () => {
    expect(decodeCallerPermissions([null, 7, { browseDataset: true }])).toEqual(
      {
        kind: "absent",
        reason: "unreadable",
      },
    );
  });

  it("ignores uninterpretable entries when readable names are present", () => {
    expect(decodeCallerPermissions(["browsedataset", null])).toMatchObject({
      kind: "read",
      capabilities: ["browse"],
      names: ["browsedataset"],
    });
  });
});

describe("decodeCallerPermissions — legacy boolean object", () => {
  it("decodes camelCase keys", () => {
    expect(
      decodeCallerPermissions({
        browseDataset: true,
        editDataset: true,
        downloadDatasetFile: false,
      }),
    ).toMatchObject({
      kind: "read",
      source: "legacy-object",
      capabilities: ["browse", "edit"],
    });
  });

  it("decodes PascalCase keys", () => {
    expect(
      decodeCallerPermissions({ BrowseDataset: true, EditDataset: false }),
    ).toMatchObject({ kind: "read", capabilities: ["browse"] });
  });

  it("still accepts the legacy downloadDataset key", () => {
    expect(decodeCallerPermissions({ downloadDataset: true })).toMatchObject({
      capabilities: ["download"],
    });
  });

  it("treats false as a real negative", () => {
    expect(decodeCallerPermissions({ browseDataset: false })).toMatchObject({
      kind: "read",
      capabilities: [],
      names: [],
    });
  });

  it("treats an empty object as a complete answer", () => {
    expect(decodeCallerPermissions({})).toMatchObject({
      kind: "read",
      capabilities: [],
    });
  });

  it("keeps the legacy manageDataset key as display input", () => {
    expect(
      decodeCallerPermissions({ browseDataset: true, manageDataset: true }),
    ).toMatchObject({ kind: "read", capabilities: ["browse", "manage"] });
  });

  it("never produces manage from a permission array, which has no such name", () => {
    expect(decodeCallerPermissions(["managedataset"])).toMatchObject({
      kind: "read",
      capabilities: [],
      unrecognized: ["managedataset"],
    });
  });

  it("reports an object with no recognisable permission keys as absent", () => {
    expect(decodeCallerPermissions({ totallyUnrelated: true })).toEqual({
      kind: "absent",
      reason: "unreadable",
    });
  });
});

describe("decodeCallerPermissions — missing evidence", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "browsedataset"],
    ["a number", 3],
    ["a boolean", true],
  ])("reports %s as absent rather than as no permissions", (_label, input) => {
    expect(decodeCallerPermissions(input)).toEqual({
      kind: "absent",
      reason: "missing",
    });
  });
});
