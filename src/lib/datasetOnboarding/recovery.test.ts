import { describe, expect, it } from "vitest";
import { PROCESS_INSTANCE_ID } from "./fixtures";
import {
  clearSessionRecord,
  isUsableScope,
  type OnboardingSessionScope,
  readSessionRecord,
  SESSION_RECORD_KEY,
  SESSION_RECORD_VERSION,
  type SessionStorageLike,
  setSharingNeedsReconciliation,
  writeSessionRecord,
} from "./recovery";
import { asProcessInstanceId } from "./types";

const SCOPE: OnboardingSessionScope = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
};

const OTHER_PRINCIPAL: OnboardingSessionScope = {
  ...SCOPE,
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
};

const OTHER_ENVIRONMENT: OnboardingSessionScope = {
  ...SCOPE,
  gatewayOrigin: "https://gateway.staging.datagems.example",
};

const PROCESS = asProcessInstanceId(PROCESS_INSTANCE_ID);
const RECORDED_AT = "2026-09-22T09:14:07.000Z";

interface Op {
  readonly op: "getItem" | "setItem" | "removeItem";
  readonly key: string;
}

/** Records every operation so "a read performs no write" is an assertion. */
const memoryStorage = (seed?: string) => {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set(SESSION_RECORD_KEY, seed);
  const ops: Op[] = [];
  const storage: SessionStorageLike = {
    getItem: (key) => {
      ops.push({ op: "getItem", key });
      return map.get(key) ?? null;
    },
    setItem: (key, value) => {
      ops.push({ op: "setItem", key });
      map.set(key, value);
    },
    removeItem: (key) => {
      ops.push({ op: "removeItem", key });
      map.delete(key);
    },
  };
  return {
    storage,
    ops,
    stored: () => map.get(SESSION_RECORD_KEY) ?? null,
    size: () => map.size,
  };
};

/** Private-mode / blocked-cookie behaviour: every operation throws. */
const throwingStorage: SessionStorageLike = {
  getItem: () => {
    throw new DOMException("access denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("quota exceeded", "QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const seeded = (overrides: Record<string, unknown>): string =>
  JSON.stringify({
    version: SESSION_RECORD_VERSION,
    processInstanceId: PROCESS_INSTANCE_ID,
    principalId: SCOPE.principalId,
    gatewayOrigin: SCOPE.gatewayOrigin,
    recordedAt: RECORDED_AT,
    sharingNeedsReconciliation: true,
    ...overrides,
  });

describe("isUsableScope", () => {
  it("requires both a principal and an environment", () => {
    expect(isUsableScope(SCOPE)).toBe(true);
    expect(isUsableScope(null)).toBe(false);
    expect(isUsableScope(undefined)).toBe(false);
    expect(isUsableScope({ ...SCOPE, principalId: "" })).toBe(false);
    expect(isUsableScope({ ...SCOPE, principalId: "   " })).toBe(false);
    expect(isUsableScope({ ...SCOPE, gatewayOrigin: "" })).toBe(false);
  });
});

describe("writeSessionRecord", () => {
  it("stores the versioned reference and reads it back for the same scope", () => {
    const store = memoryStorage();

    const written = writeSessionRecord(store.storage, {
      processInstanceId: PROCESS,
      scope: SCOPE,
      sharingNeedsReconciliation: true,
      recordedAt: RECORDED_AT,
    });

    expect(written).toEqual({
      kind: "stored",
      record: {
        version: SESSION_RECORD_VERSION,
        processInstanceId: PROCESS,
        principalId: SCOPE.principalId,
        gatewayOrigin: SCOPE.gatewayOrigin,
        recordedAt: RECORDED_AT,
        sharingNeedsReconciliation: true,
      },
    });

    const read = readSessionRecord(store.storage, SCOPE);
    expect(read).toEqual({
      kind: "restored",
      record: {
        version: SESSION_RECORD_VERSION,
        processInstanceId: PROCESS,
        principalId: SCOPE.principalId,
        gatewayOrigin: SCOPE.gatewayOrigin,
        recordedAt: RECORDED_AT,
        sharingNeedsReconciliation: true,
      },
    });
  });

  it("persists exactly the five reference fields and nothing a caller adds", () => {
    const store = memoryStorage();

    writeSessionRecord(store.storage, {
      processInstanceId: PROCESS,
      scope: SCOPE,
      sharingNeedsReconciliation: false,
      recordedAt: RECORDED_AT,
      // Fields a careless caller might pass. None may reach storage.
      ...({
        accessToken: "eyJhbGciOi.should-never-persist",
        datasetTitle: "Complex numbers",
        selectedGroups: ["public"],
        snapshot: { status: 0 },
      } as unknown as Record<string, never>),
    });

    const raw = store.stored() ?? "";
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "gatewayOrigin",
      "principalId",
      "processInstanceId",
      "recordedAt",
      "sharingNeedsReconciliation",
      "version",
    ]);
    expect(raw).not.toContain("should-never-persist");
    expect(raw).not.toContain("Complex numbers");
  });

  it("refuses to write without a resolved identity", () => {
    const store = memoryStorage();

    for (const scope of [
      { ...SCOPE, principalId: "" },
      { ...SCOPE, principalId: "  " },
      { ...SCOPE, gatewayOrigin: "" },
    ]) {
      expect(
        writeSessionRecord(store.storage, {
          processInstanceId: PROCESS,
          scope,
          sharingNeedsReconciliation: true,
        }),
      ).toEqual({ kind: "skipped", reason: "no-identity" });
    }

    expect(store.size()).toBe(0);
    expect(store.ops).toHaveLength(0);
  });

  it("refuses a blank reference or an unparsable timestamp", () => {
    const store = memoryStorage();

    expect(
      writeSessionRecord(store.storage, {
        processInstanceId: asProcessInstanceId("   "),
        scope: SCOPE,
        sharingNeedsReconciliation: true,
      }),
    ).toEqual({ kind: "skipped", reason: "invalid-reference" });

    expect(
      writeSessionRecord(store.storage, {
        processInstanceId: PROCESS,
        scope: SCOPE,
        sharingNeedsReconciliation: true,
        recordedAt: "last Tuesday",
      }),
    ).toEqual({ kind: "skipped", reason: "invalid-reference" });

    expect(store.size()).toBe(0);
  });

  it("replaces a previous attempt rather than accumulating history", () => {
    const store = memoryStorage();
    const second = asProcessInstanceId("8f1d0c92-6b3a-4e77-9a05-1d4e8c7b2f60");

    writeSessionRecord(store.storage, {
      processInstanceId: PROCESS,
      scope: SCOPE,
      sharingNeedsReconciliation: true,
      recordedAt: RECORDED_AT,
    });
    writeSessionRecord(store.storage, {
      processInstanceId: second,
      scope: SCOPE,
      sharingNeedsReconciliation: false,
      recordedAt: RECORDED_AT,
    });

    expect(store.size()).toBe(1);
    const read = readSessionRecord(store.storage, SCOPE);
    expect(read.kind === "restored" && read.record.processInstanceId).toBe(
      second,
    );
  });
});

describe("readSessionRecord", () => {
  it("restores without mutating anything", () => {
    const store = memoryStorage(seeded({}));

    expect(readSessionRecord(store.storage, SCOPE).kind).toBe("restored");

    // The only operation a successful restore may perform is a read: it cannot
    // start ingestion or apply a grant, because it touches nothing else.
    expect(store.ops).toEqual([{ op: "getItem", key: SESSION_RECORD_KEY }]);
    expect(store.stored()).toBe(seeded({}));
  });

  it("reports an empty store as absent", () => {
    const store = memoryStorage();
    expect(readSessionRecord(store.storage, SCOPE)).toEqual({ kind: "absent" });
  });

  it("does not read at all without a resolved identity", () => {
    const store = memoryStorage(seeded({}));

    expect(readSessionRecord(store.storage, null)).toEqual({ kind: "absent" });
    expect(
      readSessionRecord(store.storage, { ...SCOPE, principalId: "" }),
    ).toEqual({ kind: "absent" });

    expect(store.ops).toHaveLength(0);
    expect(store.stored()).toBe(seeded({}));
  });

  it.each([
    ["unparsable JSON", "{not json", "unparsable"],
    ["a JSON array", "[]", "not-an-object"],
    ["a JSON scalar", "42", "not-an-object"],
    ["null", "null", "not-an-object"],
  ])("discards %s and removes it", (_label, raw, reason) => {
    const store = memoryStorage(raw);

    expect(readSessionRecord(store.storage, SCOPE)).toEqual({
      kind: "discarded",
      reason,
    });
    expect(store.stored()).toBeNull();
  });

  it.each([
    ["a future version", seeded({ version: 2 })],
    ["a missing version", seeded({ version: undefined })],
    ["a string version", seeded({ version: "1" })],
  ])("discards %s and removes it", (_label, raw) => {
    const store = memoryStorage(raw);

    expect(readSessionRecord(store.storage, SCOPE)).toEqual({
      kind: "discarded",
      reason: "unknown-version",
    });
    expect(store.stored()).toBeNull();
  });

  it.each([
    ["a missing process reference", seeded({ processInstanceId: undefined })],
    ["a blank process reference", seeded({ processInstanceId: "  " })],
    ["a non-string process reference", seeded({ processInstanceId: 17 })],
    ["a blank principal", seeded({ principalId: "" })],
    ["a missing environment", seeded({ gatewayOrigin: undefined })],
    ["an unparsable timestamp", seeded({ recordedAt: "yesterday" })],
    ["a numeric timestamp", seeded({ recordedAt: 1758531247000 })],
    ["a non-boolean marker", seeded({ sharingNeedsReconciliation: "yes" })],
    ["a missing marker", seeded({ sharingNeedsReconciliation: undefined })],
  ])("discards %s and removes it", (_label, raw) => {
    const store = memoryStorage(raw);

    expect(readSessionRecord(store.storage, SCOPE)).toEqual({
      kind: "discarded",
      reason: "invalid-field",
    });
    expect(store.stored()).toBeNull();
  });

  it("never returns another principal's reference", () => {
    const store = memoryStorage(seeded({}));

    const read = readSessionRecord(store.storage, OTHER_PRINCIPAL);

    expect(read).toEqual({ kind: "foreign", reason: "principal" });
    // Refused, not destroyed: an account switch must not delete the other
    // session's reference. Sign-out calls clearSessionRecord explicitly.
    expect(store.stored()).toBe(seeded({}));
  });

  it("never returns a reference from another environment", () => {
    const store = memoryStorage(seeded({}));

    expect(readSessionRecord(store.storage, OTHER_ENVIRONMENT)).toEqual({
      kind: "foreign",
      reason: "environment",
    });
    expect(store.stored()).toBe(seeded({}));
  });

  it("ignores fields the record should not carry", () => {
    const store = memoryStorage(
      seeded({ accessToken: "leaked", datasetTitle: "Complex numbers" }),
    );

    const read = readSessionRecord(store.storage, SCOPE);

    expect(read.kind).toBe("restored");
    expect(read.kind === "restored" && Object.keys(read.record).sort()).toEqual(
      [
        "gatewayOrigin",
        "principalId",
        "processInstanceId",
        "recordedAt",
        "sharingNeedsReconciliation",
        "version",
      ],
    );
  });
});

describe("storage that is unavailable or throwing", () => {
  it("reports unavailable instead of throwing on read and write", () => {
    expect(readSessionRecord(throwingStorage, SCOPE)).toEqual({
      kind: "unavailable",
    });
    expect(
      writeSessionRecord(throwingStorage, {
        processInstanceId: PROCESS,
        scope: SCOPE,
        sharingNeedsReconciliation: true,
      }),
    ).toEqual({ kind: "unavailable" });
    expect(() => clearSessionRecord(throwingStorage)).not.toThrow();
  });

  it("treats a missing store as unavailable without throwing", () => {
    expect(readSessionRecord(null, SCOPE)).toEqual({ kind: "unavailable" });
    expect(
      writeSessionRecord(null, {
        processInstanceId: PROCESS,
        scope: SCOPE,
        sharingNeedsReconciliation: true,
      }),
    ).toEqual({ kind: "unavailable" });
    expect(() => clearSessionRecord(null)).not.toThrow();
  });

  it("survives a store that fails only on removal of an invalid record", () => {
    const failingRemove: SessionStorageLike = {
      getItem: () => "{not json",
      setItem: () => {},
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readSessionRecord(failingRemove, SCOPE)).toEqual({
      kind: "discarded",
      reason: "unparsable",
    });
  });
});

describe("setSharingNeedsReconciliation", () => {
  it("flips the marker and preserves every other field", () => {
    const store = memoryStorage(seeded({ sharingNeedsReconciliation: true }));

    const result = setSharingNeedsReconciliation(store.storage, SCOPE, false);

    expect(result.kind).toBe("stored");
    const read = readSessionRecord(store.storage, SCOPE);
    expect(read).toEqual({
      kind: "restored",
      record: {
        version: SESSION_RECORD_VERSION,
        processInstanceId: PROCESS,
        principalId: SCOPE.principalId,
        gatewayOrigin: SCOPE.gatewayOrigin,
        recordedAt: RECORDED_AT,
        sharingNeedsReconciliation: false,
      },
    });
  });

  it("writes nothing when the marker already has that value", () => {
    const store = memoryStorage(seeded({ sharingNeedsReconciliation: true }));

    expect(setSharingNeedsReconciliation(store.storage, SCOPE, true).kind).toBe(
      "stored",
    );
    expect(store.ops.some((entry) => entry.op === "setItem")).toBe(false);
  });

  it("refuses to rewrite another principal's record under this identity", () => {
    const store = memoryStorage(seeded({}));

    expect(
      setSharingNeedsReconciliation(store.storage, OTHER_PRINCIPAL, false),
    ).toEqual({ kind: "skipped", reason: "invalid-reference" });
    expect(store.stored()).toBe(seeded({}));
  });

  it("refuses without a resolved identity and on unavailable storage", () => {
    const store = memoryStorage(seeded({}));

    expect(setSharingNeedsReconciliation(store.storage, null, false)).toEqual({
      kind: "skipped",
      reason: "invalid-reference",
    });
    expect(
      setSharingNeedsReconciliation(throwingStorage, SCOPE, false),
    ).toEqual({ kind: "unavailable" });
  });
});

describe("clearSessionRecord", () => {
  it("removes the reference", () => {
    const store = memoryStorage(seeded({}));

    clearSessionRecord(store.storage);

    expect(store.stored()).toBeNull();
    expect(readSessionRecord(store.storage, SCOPE)).toEqual({ kind: "absent" });
  });
});

// ---------------------------------------------------------------------------
// Private onboarding compatibility (revision 5)
// ---------------------------------------------------------------------------

describe("records written by the private onboarding flow", () => {
  it("round-trips a false marker in the unchanged schema", () => {
    const store = memoryStorage();

    const written = writeSessionRecord(store.storage, {
      processInstanceId: PROCESS,
      scope: SCOPE,
      // The flow requested no sharing, so there is nothing to reconcile.
      sharingNeedsReconciliation: false,
      recordedAt: RECORDED_AT,
    });

    expect(written).toEqual({
      kind: "stored",
      record: {
        version: SESSION_RECORD_VERSION,
        processInstanceId: PROCESS,
        principalId: SCOPE.principalId,
        gatewayOrigin: SCOPE.gatewayOrigin,
        recordedAt: RECORDED_AT,
        sharingNeedsReconciliation: false,
      },
    });
    // Same version, same five fields: this is not a new record shape.
    expect(Object.keys(JSON.parse(store.stored() as string)).sort()).toEqual([
      "gatewayOrigin",
      "principalId",
      "processInstanceId",
      "recordedAt",
      "sharingNeedsReconciliation",
      "version",
    ]);
  });

  it("leaves an older true marker exactly as it was written", () => {
    const earlier = JSON.stringify({
      version: SESSION_RECORD_VERSION,
      processInstanceId: PROCESS,
      principalId: SCOPE.principalId,
      gatewayOrigin: SCOPE.gatewayOrigin,
      recordedAt: RECORDED_AT,
      sharingNeedsReconciliation: true,
    });
    const store = memoryStorage(earlier);

    const read = readSessionRecord(store.storage, SCOPE);

    expect(read).toEqual({
      kind: "restored",
      record: {
        version: SESSION_RECORD_VERSION,
        processInstanceId: PROCESS,
        principalId: SCOPE.principalId,
        gatewayOrigin: SCOPE.gatewayOrigin,
        recordedAt: RECORDED_AT,
        // Never rewritten to false by the migration: the earlier request was
        // real and its outcome is still unknown.
        sharingNeedsReconciliation: true,
      },
    });
    expect(store.stored()).toBe(earlier);
    expect(store.ops.filter((op) => op.op !== "getItem")).toEqual([]);
  });
});
