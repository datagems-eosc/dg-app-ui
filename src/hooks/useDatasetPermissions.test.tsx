import { act, renderHook } from "@testing-library/react";
import { StrictMode, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  DATASET_ID,
  OTHER_DATASET_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import {
  OPERATION_JOURNAL_KEY,
  OPERATION_JOURNAL_VERSION,
  type OperationStorageLike,
} from "@/lib/datasetPermissions/journal";
import type {
  DatasetRoleOperation,
  DatasetRoleOutcome,
} from "@/lib/datasetPermissions/types";
import {
  type AttemptDecision,
  type DatasetActionCapabilities,
  type DatasetPermissionsController,
  type DatasetPermissionsScope,
  type DatasetRoleOperations,
  type UseDatasetPermissionsInput,
  useDatasetPermissions,
} from "./useDatasetPermissions";

/**
 * No network and no real storage anywhere in this file. The hook's contract is
 * the injected operations object and the injected store, and every assertion
 * below is about what may be dispatched, exactly once, and which results are
 * still allowed to land.
 *
 * Responses are *deferred*: a fake that resolves immediately cannot show a
 * duplicate click being refused, because there is no window in which to click
 * twice. Nothing here proves transport-level or server-side no-replay — that
 * is task 3.2 and the controlled smoke in 4.3, and a call count on a fake
 * cannot stand in for either.
 */

const SCOPE: DatasetPermissionsScope = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
  datasetId: DATASET_ID,
};

const OTHER_ACCOUNT: DatasetPermissionsScope = {
  ...SCOPE,
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
};

const BROWSE = "dg_ds-browse";
const DOWNLOAD = "dg_ds-download";

const BOTH_ALLOWED: DatasetActionCapabilities = {
  grant: "allowed",
  revoke: "allowed",
};

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface Deferred {
  settle: (outcome: DatasetRoleOutcome) => void;
  reject: (error: unknown) => void;
  operation: DatasetRoleOperation;
}

/**
 * Deferred fake operations. Each call parks until the test settles it, so a
 * second click always arrives while the first is genuinely in flight.
 */
const makeOperations = () => {
  const assigns: Deferred[] = [];
  const removes: Deferred[] = [];

  const park =
    (into: Deferred[]) =>
    (operation: DatasetRoleOperation): Promise<DatasetRoleOutcome> =>
      new Promise<DatasetRoleOutcome>((resolve, reject) => {
        into.push({ settle: resolve, reject, operation });
      });

  const operations: DatasetRoleOperations = {
    assignRole: vi.fn(park(assigns)),
    removeRole: vi.fn(park(removes)),
  };

  return { operations, assigns, removes };
};

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

const storedEntries = (entries: Map<string, string>) => {
  const raw = entries.get(OPERATION_JOURNAL_KEY);
  return raw === undefined ? [] : JSON.parse(raw).entries;
};

const seedJournal = (
  entries: Map<string, string>,
  seeded: readonly Record<string, unknown>[],
) => {
  entries.set(
    OPERATION_JOURNAL_KEY,
    JSON.stringify({ version: OPERATION_JOURNAL_VERSION, entries: seeded }),
  );
};

const journalEntry = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  operationId: "op-earlier",
  principalId: SCOPE.principalId,
  gatewayOrigin: SCOPE.gatewayOrigin,
  datasetId: SCOPE.datasetId,
  groupId: RESEARCH_GROUP_ID,
  role: BROWSE,
  action: "assign",
  outcome: "unresolved",
  recordedAt: "2026-09-23T20:00:00.000Z",
  ...overrides,
});

/** Deterministic ids, so assertions can name the operation they mean. */
const makeIds = () => {
  let next = 0;
  return () => {
    next += 1;
    return `op-${next}`;
  };
};

const render = (input: Partial<UseDatasetPermissionsInput> = {}) => {
  const { operations, assigns, removes } = makeOperations();
  const { storage, entries } = makeStorage();

  const initial: UseDatasetPermissionsInput = {
    scope: SCOPE,
    operations,
    storage,
    capabilities: BOTH_ALLOWED,
    createOperationId: makeIds(),
    ...input,
  };

  const view = renderHook(
    (props: UseDatasetPermissionsInput) => useDatasetPermissions(props),
    { initialProps: initial, wrapper: StrictMode },
  );

  return { view, operations, assigns, removes, storage, entries, initial };
};

// ---------------------------------------------------------------------------

describe("dispatch and the duplicate guard", () => {
  it("sends one request per deliberate action", async () => {
    const { view, operations, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(1);
    expect(assigns[0].operation).toEqual({
      operationId: "op-1",
      datasetId: DATASET_ID,
      groupId: RESEARCH_GROUP_ID,
      role: BROWSE,
      action: "assign",
    });
    expect(view.result.current.operations[0].status).toBe("pending");
  });

  it("refuses a second click in the same tick, before any re-render", () => {
    const { view, operations } = render();

    act(() => {
      // Both calls happen inside one act, so neither sees the other's state
      // update. Only a synchronously acquired guard can refuse the second.
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
      const second = view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
      expect(second).toEqual({ kind: "blocked", reason: "in-flight" });
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(1);
  });

  it("blocks the inverse of a request in flight", () => {
    const { view, operations } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "remove",
        ),
      ).toEqual({ kind: "blocked", reason: "in-flight" });
    });

    expect(operations.removeRole).not.toHaveBeenCalled();
  });

  // PM-C1 R2. This replaces a test that expected three concurrent dispatches.
  // Design section 3 prevents another *dataset* action while one is pending,
  // not merely another action on the same assignment, and a view that disables
  // its controls once pending renders cannot enforce that: the second call can
  // arrive in the same tick, before any render.
  it("refuses a different assignment submitted in the same tick", () => {
    const { view, operations } = render();

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "allowed" });
      // A different role on the same group...
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          DOWNLOAD,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "in-flight" });
      // ...and a different group entirely.
      expect(
        view.result.current.requestRoleChange(
          SECOND_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "in-flight" });
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(1);
  });

  it("accepts the next dataset action once the first has settled", async () => {
    const { view, operations, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "acknowledged", httpStatus: 200 });
    });

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          SECOND_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "allowed" });
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(2);
  });

  it("frees the dataset after an uncertain outcome, but not that assignment", async () => {
    const { view, operations, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "uncertain", reason: "no-response" });
    });

    act(() => {
      // The unknown outcome keeps its own assignment blocked forever...
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "remove",
        ),
      ).toEqual({ kind: "blocked", reason: "uncertain-outcome" });
      // ...but it is settled, so it must not hold the whole dataset hostage.
      expect(
        view.result.current.requestRoleChange(
          SECOND_GROUP_ID,
          DOWNLOAD,
          "assign",
        ),
      ).toEqual({ kind: "allowed" });
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(2);
    expect(operations.removeRole).not.toHaveBeenCalled();
  });

  it("freezes the operation before awaiting", async () => {
    const { view, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    const operation = assigns[0].operation;
    expect(Object.isFrozen(operation)).toBe(true);
    expect(() => {
      (operation as { role: string }).role = DOWNLOAD;
    }).toThrow();
  });
});

describe("capability evidence", () => {
  it("dispatches nothing without a positive decision", () => {
    for (const capabilities of [
      undefined,
      { grant: "unknown" as const },
      { grant: "not-permitted" as const },
    ]) {
      const { view, operations } = render({ capabilities });
      act(() => {
        expect(
          view.result.current.requestRoleChange(
            RESEARCH_GROUP_ID,
            BROWSE,
            "assign",
          ),
        ).toEqual({ kind: "blocked", reason: "not-permitted" });
      });
      expect(operations.assignRole).not.toHaveBeenCalled();
    }
  });

  it("decides assign and remove from their own evidence", () => {
    const { view, operations } = render({
      capabilities: { grant: "allowed", revoke: "unknown" },
    });

    act(() => {
      expect(
        view.result.current.canAttempt(SECOND_GROUP_ID, BROWSE, "remove"),
      ).toEqual({ kind: "blocked", reason: "not-permitted" });
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(1);
    expect(operations.removeRole).not.toHaveBeenCalled();
  });

  it("sends nothing while the scope is unresolved", () => {
    const { view, operations } = render({ scope: null });

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "scope-unresolved" });
    });

    expect(operations.assignRole).not.toHaveBeenCalled();
    expect(view.result.current.ready).toBe(false);
  });
});

describe("recording intent before dispatch", () => {
  it("writes the unresolved entry before the request goes out", () => {
    const { view, entries, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    // The request is still in flight and the journal already knows about it.
    expect(assigns).toHaveLength(1);
    expect(storedEntries(entries)).toEqual([
      expect.objectContaining({
        operationId: "op-1",
        datasetId: DATASET_ID,
        groupId: RESEARCH_GROUP_ID,
        role: BROWSE,
        action: "assign",
        outcome: "unresolved",
        principalId: SCOPE.principalId,
      }),
    ]);
  });

  it("does not dispatch when the intent cannot be stored", () => {
    const { storage } = makeStorage({ failWrites: true });
    const { view, operations } = render({ storage });

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "storage-unavailable" });
    });

    expect(operations.assignRole).not.toHaveBeenCalled();
    expect(view.result.current.storageAvailable).toBe(false);
  });

  it("does not dispatch when there is no store at all", () => {
    const { view, operations } = render({ storage: null });

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "storage-unavailable" });
    });

    expect(operations.assignRole).not.toHaveBeenCalled();
    expect(view.result.current.ready).toBe(false);
  });

  it("does not dispatch when the existing journal cannot be read", () => {
    const { storage } = makeStorage({ failReads: true });
    const { view, operations } = render({ storage });

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "storage-unavailable" });
    });

    expect(operations.assignRole).not.toHaveBeenCalled();
  });
});

describe("outcomes", () => {
  it("acknowledges, clears the record and releases the assignment", async () => {
    const { view, assigns, entries } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "acknowledged", httpStatus: 200 });
    });

    expect(view.result.current.operations[0]).toMatchObject({
      operationId: "op-1",
      status: "acknowledged",
      httpStatus: 200,
    });
    expect(view.result.current.uncertain).toEqual([]);
    // Nothing is outstanding, so nothing is kept for recovery.
    expect(storedEntries(entries)).toEqual([]);
    expect(
      view.result.current.canAttempt(RESEARCH_GROUP_ID, BROWSE, "remove"),
    ).toEqual({ kind: "allowed" });
  });

  it("records a proven refusal and allows the action to be reconsidered", async () => {
    const { view, assigns, entries } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "refused", httpStatus: 403 });
    });

    expect(view.result.current.operations[0]).toMatchObject({
      status: "refused",
      httpStatus: 403,
    });
    // A refusal proven before any side effect leaves nothing outstanding.
    expect(storedEntries(entries)).toEqual([]);
    expect(view.result.current.uncertain).toEqual([]);
  });

  it("keeps an uncertain outcome, its record and its block", async () => {
    const { view, assigns, entries } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "uncertain", reason: "no-response" });
    });

    expect(view.result.current.operations[0]).toMatchObject({
      status: "uncertain",
      uncertainReason: "no-response",
    });
    expect(storedEntries(entries)).toEqual([
      expect.objectContaining({ operationId: "op-1", outcome: "uncertain" }),
    ]);
  });

  it("blocks the repeat and the inverse of an uncertain write", async () => {
    const { view, assigns, operations } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "uncertain", reason: "no-response" });
    });

    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "uncertain-outcome" });
      // Undoing a write whose result is unknown is as uncertain as repeating
      // it, so the inverse is refused too.
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "remove",
        ),
      ).toEqual({ kind: "blocked", reason: "uncertain-outcome" });
    });

    expect(operations.assignRole).toHaveBeenCalledTimes(1);
    expect(operations.removeRole).not.toHaveBeenCalled();
  });

  it("treats a thrown transport as uncertain, never as a refusal", async () => {
    const { view, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].reject(new TypeError("network down"));
    });

    expect(view.result.current.operations[0]).toMatchObject({
      status: "uncertain",
      uncertainReason: "no-response",
    });
  });

  it("keeps an acknowledged change while another loses its response", async () => {
    const { view, assigns } = render();

    // One at a time, per design section 3: the second change is made after the
    // first has come back, which is the sequence a user produces anyway once
    // the view disables the dataset while a write is in flight.
    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "acknowledged", httpStatus: 200 });
    });
    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        DOWNLOAD,
        "assign",
      );
    });
    await act(async () => {
      assigns[1].settle({ kind: "uncertain", reason: "no-response" });
    });

    const [first, second] = view.result.current.operations;
    expect(first).toMatchObject({ role: BROWSE, status: "acknowledged" });
    expect(second).toMatchObject({ role: DOWNLOAD, status: "uncertain" });
    // No compensation and no whole-operation retry.
    expect(view.result.current.uncertain).toHaveLength(1);
  });

  it("offers no way to clear an uncertain outcome", () => {
    const { view } = render();
    // There is deliberately no dismiss, resolve or "clear unknown" control:
    // dismissing a warning is not reconciliation.
    expect(Object.keys(view.result.current).sort()).toEqual([
      "canAttempt",
      "operations",
      "ready",
      "requestRoleChange",
      "storageAvailable",
      "uncertain",
    ]);
  });
});

describe("recovery across closing and refresh", () => {
  it("restores an interrupted operation as uncertain, not as pending", () => {
    const { storage, entries } = makeStorage();
    seedJournal(entries, [journalEntry()]);

    const { view } = render({ storage });

    expect(view.result.current.operations).toEqual([
      {
        operationId: "op-earlier",
        groupId: RESEARCH_GROUP_ID,
        role: BROWSE,
        action: "assign",
        status: "uncertain",
        restored: true,
      },
    ]);
    expect(view.result.current.uncertain).toHaveLength(1);
  });

  it("replays neither the restored write nor its inverse", () => {
    const { storage, entries } = makeStorage();
    seedJournal(entries, [journalEntry()]);

    const { view, operations } = render({ storage });

    // Nothing is dispatched on mount...
    expect(operations.assignRole).not.toHaveBeenCalled();
    expect(operations.removeRole).not.toHaveBeenCalled();

    // ...and neither direction can be started by hand either.
    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "blocked", reason: "uncertain-outcome" });
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "remove",
        ),
      ).toEqual({ kind: "blocked", reason: "uncertain-outcome" });
    });
    expect(operations.assignRole).not.toHaveBeenCalled();
    expect(operations.removeRole).not.toHaveBeenCalled();
  });

  it("survives a remount: a reload is not proof the write failed", async () => {
    const { storage, entries } = makeStorage();
    const first = render({ storage });

    act(() => {
      first.view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      first.assigns[0].settle({ kind: "uncertain", reason: "no-response" });
    });
    first.view.unmount();

    const second = render({ storage });
    expect(second.view.result.current.operations).toEqual([
      expect.objectContaining({
        operationId: "op-1",
        status: "uncertain",
        restored: true,
      }),
    ]);
    expect(storedEntries(entries)).toHaveLength(1);
  });

  it("restores only the active dataset's entries, keeping the others stored", () => {
    const { storage, entries } = makeStorage();
    seedJournal(entries, [
      journalEntry(),
      journalEntry({ operationId: "op-other", datasetId: OTHER_DATASET_ID }),
    ]);

    const { view } = render({ storage });

    expect(view.result.current.operations.map((op) => op.operationId)).toEqual([
      "op-earlier",
    ]);
    // The other dataset's uncertainty is not this view's business and is not
    // this view's to delete either.
    expect(storedEntries(entries)).toHaveLength(2);
  });

  it("does not show or act on another account's journal", () => {
    const { storage, entries } = makeStorage();
    seedJournal(entries, [
      journalEntry({ principalId: OTHER_ACCOUNT.principalId }),
    ]);

    const { view, operations } = render({ storage, scope: SCOPE });

    expect(view.result.current.operations).toEqual([]);
    // The other account's entry does not block this account either, but it is
    // still there when that account comes back.
    act(() => {
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "allowed" });
    });
    expect(operations.assignRole).toHaveBeenCalledTimes(1);
    expect(storedEntries(entries)).toHaveLength(2);
  });

  it("does not become safe through a remount into a different account", () => {
    const { storage, entries } = makeStorage();
    seedJournal(entries, [journalEntry()]);

    const other = render({ storage, scope: OTHER_ACCOUNT });
    expect(other.view.result.current.operations).toEqual([]);
    other.view.unmount();

    const mine = render({ storage });
    expect(mine.view.result.current.operations).toHaveLength(1);
    expect(storedEntries(entries)).toHaveLength(1);
  });
});

describe("ownership", () => {
  it("rejects a completion that arrives after the account changed", async () => {
    const { storage } = makeStorage();
    const { operations, assigns } = makeOperations();
    const initial: UseDatasetPermissionsInput = {
      scope: SCOPE,
      operations,
      storage,
      capabilities: BOTH_ALLOWED,
      createOperationId: makeIds(),
    };
    const view = renderHook(
      (props: UseDatasetPermissionsInput) => useDatasetPermissions(props),
      { initialProps: initial, wrapper: StrictMode },
    );

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    view.rerender({ ...initial, scope: OTHER_ACCOUNT });
    await act(async () => {
      assigns[0].settle({ kind: "acknowledged", httpStatus: 200 });
    });

    // The previous owner's acknowledgement is not shown as the new owner's.
    expect(view.result.current.operations).toEqual([]);
  });

  it("does not revive the first A's callbacks after A → unavailable → A", async () => {
    const { storage } = makeStorage();
    const { operations, assigns } = makeOperations();
    const initial: UseDatasetPermissionsInput = {
      scope: SCOPE,
      operations,
      storage,
      capabilities: BOTH_ALLOWED,
      createOperationId: makeIds(),
    };
    const view = renderHook(
      (props: UseDatasetPermissionsInput) => useDatasetPermissions(props),
      { initialProps: initial, wrapper: StrictMode },
    );

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    // Identity is lost and comes back the same. The scope *key* is identical,
    // so only a generation bumped on teardown can tell the two apart.
    view.rerender({ ...initial, scope: null });
    view.rerender({ ...initial, scope: SCOPE });

    await act(async () => {
      assigns[0].settle({ kind: "acknowledged", httpStatus: 200 });
    });

    // The second A restored the entry the first A left unresolved, and the
    // stale acknowledgement did not turn it into a success.
    expect(view.result.current.operations).toEqual([
      expect.objectContaining({
        operationId: "op-1",
        status: "uncertain",
        restored: true,
      }),
    ]);
  });

  it("preserves state and in-flight work across a token refresh", async () => {
    const { storage } = makeStorage();
    const first = makeOperations();
    const initial: UseDatasetPermissionsInput = {
      scope: SCOPE,
      operations: first.operations,
      storage,
      capabilities: BOTH_ALLOWED,
      createOperationId: makeIds(),
    };
    const view = renderHook(
      (props: UseDatasetPermissionsInput) => useDatasetPermissions(props),
      { initialProps: initial, wrapper: StrictMode },
    );

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });

    // A refreshed session hands over a *new* operations object for the same
    // principal. That is not a scope change: nothing is cleared or restarted.
    const refreshed = makeOperations();
    view.rerender({
      ...initial,
      scope: { ...SCOPE },
      operations: refreshed.operations,
    });

    expect(view.result.current.operations[0].status).toBe("pending");

    await act(async () => {
      first.assigns[0].settle({ kind: "acknowledged", httpStatus: 200 });
    });

    expect(view.result.current.operations[0].status).toBe("acknowledged");
    expect(refreshed.operations.assignRole).not.toHaveBeenCalled();
  });

  it("shows no operation from a dataset that is no longer open", () => {
    const { storage } = makeStorage();
    const { operations } = makeOperations();
    const initial: UseDatasetPermissionsInput = {
      scope: SCOPE,
      operations,
      storage,
      capabilities: BOTH_ALLOWED,
      createOperationId: makeIds(),
    };
    const view = renderHook(
      (props: UseDatasetPermissionsInput) => useDatasetPermissions(props),
      { initialProps: initial, wrapper: StrictMode },
    );

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    expect(view.result.current.operations).toHaveLength(1);

    view.rerender({
      ...initial,
      scope: { ...SCOPE, datasetId: OTHER_DATASET_ID },
    });

    expect(view.result.current.operations).toEqual([]);
  });
});

/**
 * PM-C1 R1. The returned `canAttempt` and `requestRoleChange` are ordinary
 * values a caller may hold on to — in a memoised child, a closure, a callback
 * ref. Every case below keeps one across a change and then invokes it. The
 * existing late-response tests prove a *completion* is rejected; they say
 * nothing about an action started through an obsolete handle, which is a
 * different moment and a different failure.
 */
describe("retained action handles", () => {
  const retain = (input: Partial<UseDatasetPermissionsInput> = {}) => {
    const harness = render(input);
    return {
      ...harness,
      request: harness.view.result.current.requestRoleChange,
      canAttempt: harness.view.result.current.canAttempt,
    };
  };

  const expectNothingHappened = (
    operations: DatasetRoleOperations,
    entries: Map<string, string>,
  ) => {
    expect(operations.assignRole).not.toHaveBeenCalled();
    expect(operations.removeRole).not.toHaveBeenCalled();
    // Refused before the journal, not after it: an obsolete handle must not
    // leave a recovery record owned by the principal that replaced it.
    expect(entries.size).toBe(0);
  };

  it.each([
    ["the account", OTHER_ACCOUNT],
    ["the dataset", { ...SCOPE, datasetId: OTHER_DATASET_ID }],
    ["the Gateway", { ...SCOPE, gatewayOrigin: "https://other.invalid" }],
  ])("refuses an old handle after %s changes", (_label, replacement) => {
    const { view, initial, request, operations, entries } = retain();

    view.rerender({ ...initial, scope: replacement, operations });

    act(() => {
      expect(request(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "blocked",
        reason: "scope-unresolved",
      });
    });
    expectNothingHappened(operations, entries);
  });

  it("refuses an old handle after identity is lost and comes back", () => {
    const { view, initial, request, operations, entries } = retain();

    // The scope *key* is textually identical on return. Only a lifetime that
    // counts entries, rather than comparing text, can tell the two apart.
    view.rerender({ ...initial, scope: null });
    view.rerender({ ...initial, scope: { ...SCOPE } });

    act(() => {
      expect(request(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "blocked",
        reason: "scope-unresolved",
      });
    });
    expectNothingHappened(operations, entries);
  });

  it("refuses an old handle after the view is gone", () => {
    const { view, request, operations, entries } = retain();

    view.unmount();

    act(() => {
      expect(request(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "blocked",
        reason: "scope-unresolved",
      });
    });
    expectNothingHappened(operations, entries);
  });

  it("refuses an old handle whose authority has since been lost", () => {
    const { view, initial, request, operations, entries } = retain();

    // Not an owner change: same principal, same dataset. The handle is still
    // alive, and must be judged against current authority rather than the
    // authority of the render that produced it.
    view.rerender({
      ...initial,
      capabilities: { grant: "not-permitted", revoke: "not-permitted" },
    });

    act(() => {
      expect(request(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "blocked",
        reason: "not-permitted",
      });
    });
    expectNothingHappened(operations, entries);
  });

  it("refuses through a retained canAttempt as well", () => {
    const { view, initial, canAttempt, operations } = retain();

    view.rerender({ ...initial, scope: OTHER_ACCOUNT, operations });

    expect(canAttempt(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
      kind: "blocked",
      reason: "scope-unresolved",
    });
  });

  it("keeps a retained handle usable for its own owner (control)", () => {
    const { view, initial, request, operations } = retain();

    // Same owner, rendered again with an equal but not identical scope object.
    // Re-rendering must not invalidate anything.
    view.rerender({ ...initial, scope: { ...SCOPE } });

    act(() => {
      expect(request(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "allowed",
      });
    });
    expect(operations.assignRole).toHaveBeenCalledTimes(1);
  });

  it("sends a retained handle's change through a refreshed session (control)", () => {
    const { view, initial, request } = retain();

    // A same-principal token refresh hands over a new operations object. The
    // handle stays alive and must use the *current* transport, not the one it
    // closed over.
    const refreshed = makeOperations();
    view.rerender({
      ...initial,
      scope: { ...SCOPE },
      operations: refreshed.operations,
    });

    act(() => {
      expect(request(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "allowed",
      });
    });
    expect(refreshed.operations.assignRole).toHaveBeenCalledTimes(1);
  });

  it("refuses the previous owner's handle while the current one works", () => {
    const { view, initial, request: oldRequest } = retain();
    const second = makeOperations();

    view.rerender({
      ...initial,
      scope: OTHER_ACCOUNT,
      operations: second.operations,
    });

    act(() => {
      expect(oldRequest(RESEARCH_GROUP_ID, BROWSE, "assign")).toEqual({
        kind: "blocked",
        reason: "scope-unresolved",
      });
      expect(
        view.result.current.requestRoleChange(
          RESEARCH_GROUP_ID,
          BROWSE,
          "assign",
        ),
      ).toEqual({ kind: "allowed" });
    });

    expect(second.operations.assignRole).toHaveBeenCalledTimes(1);
  });

  /**
   * PM-C1 Correction 02. A layout effect runs after the replacement render has
   * committed but before this hook's passive effect has swapped owners, so in
   * that window `activeLifetimeRef` still names the *previous* lifetime while
   * the render has already advanced to the next one. A handle invoked there is
   * obsolete even though the mounted-owner check alone still accepts it, so the
   * guard has to compare against the latest rendered lifetime as well.
   *
   * The cases above invoke their handles after `rerender` has flushed passive
   * effects, which is a later and easier moment; these are the earlier one.
   */
  describe("invoked after the replacement commit, before passive effects", () => {
    const renderAndInvokeInLayoutEffect = (
      replacement: DatasetPermissionsScope | null,
    ) => {
      const { operations } = makeOperations();
      const { storage, entries } = makeStorage();
      const createOperationId = makeIds();
      // Boxed so the assignments made inside the render callback are visible
      // here without narrowing them away.
      const held: {
        request: DatasetPermissionsController["requestRoleChange"] | null;
        decision: AttemptDecision | null;
      } = { request: null, decision: null };

      const view = renderHook(
        ({
          scope,
          invoke,
        }: {
          scope: DatasetPermissionsScope | null;
          invoke: boolean;
        }) => {
          const controller = useDatasetPermissions({
            scope,
            operations,
            storage,
            capabilities: BOTH_ALLOWED,
            createOperationId,
          });
          useLayoutEffect(() => {
            if (invoke && held.request !== null) {
              held.decision = held.request(RESEARCH_GROUP_ID, BROWSE, "assign");
            }
          }, [invoke]);
          return controller;
        },
        {
          initialProps: {
            scope: SCOPE as DatasetPermissionsScope | null,
            invoke: false,
          },
          wrapper: StrictMode,
        },
      );

      // Taken once the first owner is fully mounted, exactly as a memoised
      // child would have received it.
      held.request = view.result.current.requestRoleChange;
      view.rerender({ scope: replacement, invoke: true });

      return { view, operations, entries, held };
    };

    it.each([
      ["the account changes", OTHER_ACCOUNT],
      ["the dataset changes", { ...SCOPE, datasetId: OTHER_DATASET_ID }],
      ["the scope becomes unavailable", null],
    ])(
      "refuses an old handle before its owner is torn down: %s",
      (_label, replacement) => {
        const { view, operations, entries, held } =
          renderAndInvokeInLayoutEffect(replacement);

        expect(held.decision).toEqual({
          kind: "blocked",
          reason: "scope-unresolved",
        });
        expectNothingHappened(operations, entries);
        view.unmount();
      },
    );

    it("still sends for an unchanged owner in the same window (control)", () => {
      const { view, operations, entries, held } = renderAndInvokeInLayoutEffect(
        { ...SCOPE },
      );

      expect(held.decision).toEqual({ kind: "allowed" });
      expect(operations.assignRole).toHaveBeenCalledTimes(1);
      expect(storedEntries(entries)).toHaveLength(1);
      view.unmount();
    });
  });
});

describe("no replay is claimed beyond this layer", () => {
  it("counts calls on a fake, which is not transport or server idempotency", async () => {
    const { view, operations, assigns } = render();

    act(() => {
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
      view.result.current.requestRoleChange(
        RESEARCH_GROUP_ID,
        BROWSE,
        "assign",
      );
    });
    await act(async () => {
      assigns[0].settle({ kind: "uncertain", reason: "no-response" });
    });

    // One call is what this hook guarantees. Whether the *transport* replays
    // on 401, and whether the server tolerates a repeat, are task 3.2 and
    // PM-06 respectively; neither is established by this number.
    expect(operations.assignRole).toHaveBeenCalledTimes(1);
  });
});
