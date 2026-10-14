import { describe, expect, it } from "vitest";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  EVERYONE_GROUP_ID,
  RESEARCH_GROUP_ID,
  UNDISCOVERED_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import {
  AMBIGUOUS_GROUPS,
  DISCOVERED_GROUPS,
  DUPLICATE_EVERYONE_GROUP,
  EVERYONE_GROUP,
  KNOWN_GRANTS,
  operation,
  RESEARCH_GROUP,
} from "./fixtures";
import {
  buildAccessRows,
  buildGrantTargets,
  groupLabel,
  hasPendingWrite,
  holderLabel,
  isKnownRole,
  uncertainOperations,
} from "./rows";

const known = { kind: "known", grants: [...KNOWN_GRANTS] } as const;

const build = (
  overrides: Partial<Parameters<typeof buildAccessRows>[0]> = {},
) =>
  buildAccessRows({
    groups: DISCOVERED_GROUPS,
    recipients: known,
    operations: [],
    everyoneGroupId: null,
    ...overrides,
  });

const cellFor = (
  rows: ReturnType<typeof buildAccessRows>,
  groupId: string,
  key: "browse" | "edit" | "manage",
) =>
  rows
    ?.find((row) => row.groupId === groupId)
    ?.cells.find((c) => c.key === key);

describe("buildAccessRows", () => {
  it("renders no rows at all when the recipient read is not known", () => {
    for (const recipients of [
      { kind: "failed" } as const,
      { kind: "unknown", reason: "not-supported" } as const,
      { kind: "unknown", reason: "not-read" } as const,
    ]) {
      expect(build({ recipients })).toBeNull();
    }
  });

  it("marks held roles granted and unheld roles not granted from a known read", () => {
    const rows = build();
    expect(cellFor(rows, RESEARCH_GROUP_ID, "browse")?.granted).toBe(true);
    expect(cellFor(rows, RESEARCH_GROUP_ID, "edit")?.granted).toBe(false);
  });

  it("requests the Gateway role identifier, not the display label", () => {
    const cell = cellFor(build(), RESEARCH_GROUP_ID, "manage");
    expect(cell?.role).toBe(DATASET_ROLE_MAP.manage);
    expect(cell?.label).toBe("Manage");
  });

  it("moves a switch for an acknowledged operation only", () => {
    const assignEdit = {
      groupId: RESEARCH_GROUP_ID,
      role: DATASET_ROLE_MAP.edit,
      action: "assign" as const,
    };

    expect(
      cellFor(
        build({
          operations: [operation({ ...assignEdit, status: "pending" })],
        }),
        RESEARCH_GROUP_ID,
        "edit",
      )?.granted,
    ).toBe(false);
    expect(
      cellFor(
        build({
          operations: [operation({ ...assignEdit, status: "refused" })],
        }),
        RESEARCH_GROUP_ID,
        "edit",
      )?.granted,
    ).toBe(false);
    expect(
      cellFor(
        build({
          operations: [operation({ ...assignEdit, status: "uncertain" })],
        }),
        RESEARCH_GROUP_ID,
        "edit",
      )?.granted,
    ).toBe(false);
    expect(
      cellFor(
        build({
          operations: [operation({ ...assignEdit, status: "acknowledged" })],
        }),
        RESEARCH_GROUP_ID,
        "edit",
      )?.granted,
    ).toBe(true);
  });

  it("keeps an acknowledged removal removed while a later write is uncertain", () => {
    const rows = build({
      operations: [
        operation({
          operationId: "op-1",
          role: DATASET_ROLE_MAP.browse,
          action: "remove",
          status: "acknowledged",
        }),
        operation({
          operationId: "op-2",
          role: DATASET_ROLE_MAP.browse,
          action: "assign",
          status: "uncertain",
        }),
      ],
    });
    const cell = cellFor(rows, RESEARCH_GROUP_ID, "browse");
    expect(cell?.granted).toBe(false);
    expect(cell?.activity.kind).toBe("uncertain");
  });

  it("identifies the public audience only from the model's decision", () => {
    const withEveryone = build({ everyoneGroupId: EVERYONE_GROUP.id });
    expect(
      withEveryone?.find((row) => row.groupId === EVERYONE_GROUP.id)
        ?.publicAudience,
    ).toBe(true);

    // Its name and id are never allowed to decide this.
    const research = withEveryone?.find(
      (row) => row.groupId === RESEARCH_GROUP.id,
    );
    expect(research).toMatchObject({
      publicAudience: false,
      ambiguousAudience: false,
    });
  });

  it("keeps Everyone semantics when no single audience can be identified", () => {
    // Ambiguity makes no candidate public — and no candidate ordinary either.
    const rows = build({ groups: AMBIGUOUS_GROUPS, everyoneGroupId: null });
    for (const id of [EVERYONE_GROUP.id, DUPLICATE_EVERYONE_GROUP.id]) {
      expect(rows?.find((row) => row.groupId === id)).toMatchObject({
        publicAudience: false,
        ambiguousAudience: true,
      });
    }
    expect(
      rows?.find((row) => row.groupId === RESEARCH_GROUP.id),
    ).toMatchObject({ publicAudience: false, ambiguousAudience: false });

    const targets = buildGrantTargets(AMBIGUOUS_GROUPS, null);
    expect(
      targets
        .filter((target) => target.ambiguousAudience)
        .map((t) => t.groupId),
    ).toEqual([EVERYONE_GROUP.id, DUPLICATE_EVERYONE_GROUP.id]);
    expect(targets.some((target) => target.publicAudience)).toBe(false);
  });

  it("carries the uncertain reason through for assistive text", () => {
    const rows = build({
      operations: [
        operation({
          role: DATASET_ROLE_MAP.edit,
          status: "uncertain",
          uncertainReason: "no-response",
        }),
      ],
    });
    const activity = cellFor(rows, RESEARCH_GROUP_ID, "edit")?.activity;
    expect(activity).toMatchObject({
      kind: "uncertain",
      reason: "no-response",
    });
  });
});

describe("the union of discovery and the inventory", () => {
  const holderGrants = {
    kind: "known",
    grants: [
      { groupId: RESEARCH_GROUP_ID, role: DATASET_ROLE_MAP.browse },
      { groupId: RESEARCH_GROUP_ID, role: "dg_ds-curate" },
      { groupId: UNDISCOVERED_GROUP_ID, role: DATASET_ROLE_MAP.edit },
      { groupId: UNDISCOVERED_GROUP_ID, role: "dg_ds-curate" },
    ],
  } as const;

  it("keeps a holder discovery cannot identify, read-only and after the others", () => {
    const rows = build({ recipients: holderGrants }) ?? [];
    const holder = rows.at(-1);

    expect(rows.map((row) => row.groupId)).toEqual([
      ...DISCOVERED_GROUPS.map((group) => group.id),
      UNDISCOVERED_GROUP_ID,
    ]);
    expect(holder).toMatchObject({
      groupId: UNDISCOVERED_GROUP_ID,
      name: holderLabel(UNDISCOVERED_GROUP_ID),
      readOnly: true,
      // Nothing is known about its audience, so nothing is claimed.
      publicAudience: false,
      ambiguousAudience: false,
      otherRoles: ["dg_ds-curate"],
    });
    expect(cellFor(rows, UNDISCOVERED_GROUP_ID, "edit")?.granted).toBe(true);
  });

  it("names a holder by its id, never by a guessed name", () => {
    expect(holderLabel(UNDISCOVERED_GROUP_ID)).toBe(
      `Group ${UNDISCOVERED_GROUP_ID}`,
    );
  });

  it("keeps a role with no control as text on an editable row", () => {
    const rows = build({ recipients: holderGrants });
    const research = rows?.find((row) => row.groupId === RESEARCH_GROUP_ID);
    expect(research?.readOnly).toBe(false);
    expect(research?.otherRoles).toEqual(["dg_ds-curate"]);
    expect(research?.cells.map((cell) => cell.role)).not.toContain(
      "dg_ds-curate",
    );
  });

  it("keeps every holder when discovery failed, all of them read-only", () => {
    const rows = build({ groups: null }) ?? [];
    expect(rows.map((row) => row.groupId)).toEqual([
      RESEARCH_GROUP_ID,
      KNOWN_GRANTS[2].groupId,
    ]);
    expect(rows.every((row) => row.readOnly)).toBe(true);
  });

  it("keeps every holder when discovery returned no group", () => {
    const rows = build({ groups: [] }) ?? [];
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.readOnly)).toBe(true);
  });

  it("offers discovered groups as unassigned targets under an empty inventory", () => {
    const rows = build({ recipients: { kind: "known", grants: [] } }) ?? [];
    expect(rows.map((row) => row.groupId)).toEqual(
      DISCOVERED_GROUPS.map((group) => group.id),
    );
    expect(rows.every((row) => !row.readOnly)).toBe(true);
    expect(rows.every((row) => row.cells.every((cell) => !cell.granted))).toBe(
      true,
    );
  });

  it("joins by exact id, never by display name", () => {
    // A holder whose id differs only in case is a different group here, and
    // a discovered group's name is never used to claim a holder.
    const rows =
      build({
        recipients: {
          kind: "known",
          grants: [
            {
              groupId: RESEARCH_GROUP_ID.toUpperCase(),
              role: DATASET_ROLE_MAP.browse,
            },
          ],
        },
      }) ?? [];
    expect(cellFor(rows, RESEARCH_GROUP_ID, "browse")?.granted).toBe(false);
    expect(rows.at(-1)).toMatchObject({
      groupId: RESEARCH_GROUP_ID.toUpperCase(),
      readOnly: true,
    });
  });

  it("lets a confirmed acknowledgement give way to the read", () => {
    const assigned = operation({
      operationId: "ack",
      role: DATASET_ROLE_MAP.edit,
      status: "acknowledged",
    });
    // Unconfirmed: the acknowledgement is drawn, whatever the read says.
    expect(
      cellFor(build({ operations: [assigned] }), RESEARCH_GROUP_ID, "edit")
        ?.granted,
    ).toBe(true);
    // Confirmed by an earlier read, then removed elsewhere: the newer read
    // is drawn, so the later change can show.
    expect(
      cellFor(
        build({
          operations: [assigned],
          confirmedOperationIds: new Set(["ack"]),
        }),
        RESEARCH_GROUP_ID,
        "edit",
      )?.granted,
    ).toBe(false);
  });

  it("never marks a holder as the public audience", () => {
    const rows =
      build({
        groups: [RESEARCH_GROUP],
        everyoneGroupId: EVERYONE_GROUP_ID,
        recipients: {
          kind: "known",
          grants: [
            { groupId: EVERYONE_GROUP_ID, role: DATASET_ROLE_MAP.browse },
          ],
        },
      }) ?? [];
    expect(rows.find((row) => row.groupId === EVERYONE_GROUP_ID)).toMatchObject(
      { readOnly: true, publicAudience: false },
    );
  });

  it("recognises only the dataset roles it has controls for", () => {
    expect(isKnownRole(DATASET_ROLE_MAP.browse)).toBe(true);
    expect(isKnownRole(" DG_DS-BROWSE ")).toBe(true);
    expect(isKnownRole("dg_ds-curate")).toBe(false);
  });
});

describe("operation helpers", () => {
  it("reports a dataset-wide pending write", () => {
    expect(hasPendingWrite([])).toBe(false);
    expect(hasPendingWrite([operation({ status: "acknowledged" })])).toBe(
      false,
    );
    expect(hasPendingWrite([operation({ status: "pending" })])).toBe(true);
  });

  it("collects uncertain operations, restored ones included", () => {
    const collected = uncertainOperations([
      operation({ operationId: "a", status: "acknowledged" }),
      operation({ operationId: "b", status: "uncertain" }),
      operation({ operationId: "c", status: "uncertain", restored: true }),
    ]);
    expect(collected.map((entry) => entry.operationId)).toEqual(["b", "c"]);
  });
});

describe("groupLabel", () => {
  it("uses the group name when there is one", () => {
    expect(groupLabel(RESEARCH_GROUP)).toBe("Baltic Modelling Team");
  });

  it("falls back to the id rather than inventing a name", () => {
    expect(groupLabel({ id: "g-1" })).toBe("Unnamed group g-1");
    expect(groupLabel({ id: "g-1", name: "  " })).toBe("Unnamed group g-1");
  });
});
