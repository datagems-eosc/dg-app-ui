import { describe, expect, it } from "vitest";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import { RESEARCH_GROUP_ID } from "@/lib/datasetPermissions/fixtures";
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
