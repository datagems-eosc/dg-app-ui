import { beforeEach, describe, expect, it } from "vitest";
import {
  assignmentKey,
  clearSettled,
  markUncertain,
  OPERATION_JOURNAL_KEY,
  OPERATION_JOURNAL_VERSION,
  type OperationScope,
  type OperationStorageLike,
  readJournal,
  recordUnresolved,
} from "./journal";

const SCOPE: OperationScope = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
};

const OTHER_PRINCIPAL: OperationScope = {
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
  gatewayOrigin: SCOPE.gatewayOrigin,
};

const OTHER_ENVIRONMENT: OperationScope = {
  principalId: SCOPE.principalId,
  gatewayOrigin: "https://gateway.staging.datagems.example",
};

const INTENT = {
  operationId: "op-1",
  datasetId: "3e0a9d64-2c51-4b8f-9a7d-6f1b0c2e4d75",
  groupId: "5f6e7d8c-9b0a-41c2-83d4-e5f6a7b8c9d0",
  role: "dg_ds-browse",
  action: "assign" as const,
  recordedAt: "2026-09-23T20:00:00.000Z",
};

/** In-memory storage that can be told to refuse reads, writes or both. */
const makeStorage = (
  options: { failWrites?: boolean; failReads?: boolean } = {},
) => {
  const entries = new Map<string, string>();
  const storage: OperationStorageLike = {
    getItem(key) {
      if (options.failReads) throw new Error("blocked");
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.failWrites) throw new Error("quota");
      entries.set(key, value);
    },
    removeItem(key) {
      if (options.failWrites) throw new Error("quota");
      entries.delete(key);
    },
  };
  return { storage, entries };
};

describe("recording and restoring", () => {
  let storage: OperationStorageLike;
  let entries: Map<string, string>;

  beforeEach(() => {
    ({ storage, entries } = makeStorage());
  });

  it("records an unresolved intent and restores it", () => {
    expect(recordUnresolved(storage, SCOPE, INTENT)).toEqual({
      kind: "stored",
    });

    const restored = readJournal(storage, SCOPE);
    expect(restored).toEqual({
      kind: "read",
      entries: [
        {
          ...INTENT,
          principalId: SCOPE.principalId,
          gatewayOrigin: SCOPE.gatewayOrigin,
          outcome: "unresolved",
        },
      ],
    });
  });

  it("stores identifiers only — no names, bodies or credentials", () => {
    recordUnresolved(storage, SCOPE, INTENT);
    const raw = entries.get(OPERATION_JOURNAL_KEY) ?? "";
    const stored = JSON.parse(raw);

    expect(stored.version).toBe(OPERATION_JOURNAL_VERSION);
    expect(Object.keys(stored.entries[0]).sort()).toEqual([
      "action",
      "datasetId",
      "gatewayOrigin",
      "groupId",
      "operationId",
      "outcome",
      "principalId",
      "recordedAt",
      "role",
    ]);
  });

  it("promotes an entry to uncertain and keeps it", () => {
    recordUnresolved(storage, SCOPE, INTENT);
    expect(markUncertain(storage, SCOPE, INTENT.operationId)).toEqual({
      kind: "stored",
    });

    const restored = readJournal(storage, SCOPE);
    if (restored.kind !== "read") throw new Error("expected a read");
    expect(restored.entries[0].outcome).toBe("uncertain");
  });

  it("clears a settled entry", () => {
    recordUnresolved(storage, SCOPE, INTENT);
    clearSettled(storage, SCOPE, INTENT.operationId);

    expect(readJournal(storage, SCOPE)).toEqual({ kind: "read", entries: [] });
    // An empty journal leaves nothing behind in storage either.
    expect(entries.has(OPERATION_JOURNAL_KEY)).toBe(false);
  });
});

describe("scope isolation", () => {
  it("hides another account's entries without erasing them", () => {
    const { storage } = makeStorage();
    recordUnresolved(storage, SCOPE, INTENT);
    recordUnresolved(storage, OTHER_PRINCIPAL, {
      ...INTENT,
      operationId: "op-2",
    });

    const mine = readJournal(storage, SCOPE);
    if (mine.kind !== "read") throw new Error("expected a read");
    expect(mine.entries.map((entry) => entry.operationId)).toEqual(["op-1"]);

    // The other account's own uncertainty is still there when it returns.
    const theirs = readJournal(storage, OTHER_PRINCIPAL);
    if (theirs.kind !== "read") throw new Error("expected a read");
    expect(theirs.entries.map((entry) => entry.operationId)).toEqual(["op-2"]);
  });

  it("separates environments as well as principals", () => {
    const { storage } = makeStorage();
    recordUnresolved(storage, OTHER_ENVIRONMENT, INTENT);

    expect(readJournal(storage, SCOPE)).toEqual({ kind: "read", entries: [] });
  });

  it("cannot clear or promote another account's entry", () => {
    const { storage } = makeStorage();
    recordUnresolved(storage, OTHER_PRINCIPAL, INTENT);

    clearSettled(storage, SCOPE, INTENT.operationId);
    markUncertain(storage, SCOPE, INTENT.operationId);

    const theirs = readJournal(storage, OTHER_PRINCIPAL);
    if (theirs.kind !== "read") throw new Error("expected a read");
    expect(theirs.entries[0].outcome).toBe("unresolved");
  });

  it("writes nothing without a usable scope", () => {
    const { storage, entries } = makeStorage();
    expect(
      recordUnresolved(
        storage,
        { principalId: "  ", gatewayOrigin: "x" },
        INTENT,
      ),
    ).toEqual({ kind: "unavailable" });
    expect(recordUnresolved(storage, null, INTENT)).toEqual({
      kind: "unavailable",
    });
    expect(entries.size).toBe(0);
  });
});

describe("unusable storage", () => {
  it("reports a refused write rather than pretending it stored", () => {
    const { storage } = makeStorage({ failWrites: true });
    expect(recordUnresolved(storage, SCOPE, INTENT)).toEqual({
      kind: "unavailable",
    });
  });

  it("reports a refused read as unavailable", () => {
    const { storage } = makeStorage({ failReads: true });
    expect(readJournal(storage, SCOPE)).toEqual({ kind: "unavailable" });
  });

  it("treats a missing store as unavailable, never as an empty journal", () => {
    expect(readJournal(null, SCOPE)).toEqual({ kind: "unavailable" });
    expect(recordUnresolved(null, SCOPE, INTENT)).toEqual({
      kind: "unavailable",
    });
  });

  it("refuses an unreadable document instead of overwriting it", () => {
    const { storage, entries } = makeStorage();
    entries.set(OPERATION_JOURNAL_KEY, "{not json");

    expect(readJournal(storage, SCOPE)).toEqual({
      kind: "discarded",
      reason: "unparsable",
    });
    // Recording must not proceed: rewriting the document would destroy
    // whatever outstanding operations it held.
    expect(recordUnresolved(storage, SCOPE, INTENT)).toEqual({
      kind: "unavailable",
    });
    expect(entries.get(OPERATION_JOURNAL_KEY)).toBe("{not json");
  });

  it("refuses a document from an unknown version", () => {
    const { storage, entries } = makeStorage();
    entries.set(
      OPERATION_JOURNAL_KEY,
      JSON.stringify({ version: 99, entries: [] }),
    );
    expect(readJournal(storage, SCOPE)).toEqual({
      kind: "discarded",
      reason: "unknown-version",
    });
  });

  it("refuses the whole document when one entry is invalid", () => {
    const { storage, entries } = makeStorage();
    entries.set(
      OPERATION_JOURNAL_KEY,
      JSON.stringify({
        version: OPERATION_JOURNAL_VERSION,
        entries: [
          {
            ...INTENT,
            principalId: SCOPE.principalId,
            gatewayOrigin: SCOPE.gatewayOrigin,
            outcome: "unresolved",
          },
          { operationId: "op-broken" },
        ],
      }),
    );

    // A partially readable journal would understate what is outstanding, and
    // understating it is the direction that lets a repeat through.
    expect(readJournal(storage, SCOPE)).toEqual({
      kind: "discarded",
      reason: "invalid-field",
    });
  });
});

describe("assignmentKey", () => {
  it("is blind to the action, so a grant and its revoke collide", () => {
    const assignment = {
      datasetId: INTENT.datasetId,
      groupId: INTENT.groupId,
      role: INTENT.role,
    };
    expect(assignmentKey({ ...assignment })).toBe(assignmentKey(assignment));
  });

  it("separates roles, groups and datasets", () => {
    const base = {
      datasetId: "d",
      groupId: "g",
      role: "dg_ds-browse",
    };
    expect(assignmentKey(base)).not.toBe(
      assignmentKey({ ...base, role: "dg_ds-download" }),
    );
    expect(assignmentKey(base)).not.toBe(
      assignmentKey({ ...base, groupId: "g2" }),
    );
    expect(assignmentKey(base)).not.toBe(
      assignmentKey({ ...base, datasetId: "d2" }),
    );
  });

  it("cannot be forged by a value containing the separator", () => {
    expect(assignmentKey({ datasetId: "d", groupId: "g", role: "r" })).not.toBe(
      assignmentKey({ datasetId: "d\u0000g", groupId: "", role: "r" }),
    );
  });
});
