import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DATASET_ID,
  EVERYONE_GROUP_ID,
  OTHER_DATASET_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
  UNDISCOVERED_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import type {
  DatasetPermissionsGateway,
  GroupsReadResult,
  PermissionsReadResult,
  RecipientReadResult,
} from "@/lib/datasetPermissions/gateway";
import {
  exhaustivePermissionsRead,
  PERMISSIONS_FAILED,
  projectedPermissionsRead,
} from "@/lib/datasetPermissions/model";
import {
  ACCESS_ACTION_NAMES,
  type GroupRoleGrant,
} from "@/lib/datasetPermissions/types";
import {
  type AcknowledgedChange,
  type DatasetAccessScope,
  useDatasetPermissionsAccess,
} from "./useDatasetPermissionsAccess";

/**
 * The read side, with the adapter faked at its own boundary.
 *
 * Nothing here touches the network: the gateway is an object of `vi.fn()`s
 * returning the adapter's own result types, so what is under test is the
 * orchestration — what is asked for, in what order, whose answer it is, and
 * what is deliberately *not* asked for. Every race is driven by deferred
 * replies released in a chosen order, not by timers.
 */

const SCOPE: DatasetAccessScope = {
  principalId: "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380",
  gatewayOrigin: "https://gateway.dev.datagems.example",
  datasetId: DATASET_ID,
};

const OTHER_ACCOUNT: DatasetAccessScope = {
  ...SCOPE,
  principalId: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc",
};

const GROUPS = [
  { id: EVERYONE_GROUP_ID, name: "Everyone", semantics: ["everyone"] },
  { id: RESEARCH_GROUP_ID, name: "Research", semantics: [] },
];

const ALL_ACTION_NAMES = [
  ACCESS_ACTION_NAMES.grant,
  ACCESS_ACTION_NAMES.revoke,
  ACCESS_ACTION_NAMES.lookupRecipients,
];

/** What the adapter's dataset projection asks for. See `gateway.ts`. */
const PROJECTED = [
  ACCESS_ACTION_NAMES.grant,
  ACCESS_ACTION_NAMES.revoke,
  ACCESS_ACTION_NAMES.lookupRecipients,
];

const globalRead = (names: readonly string[]): PermissionsReadResult => ({
  evidence: exhaustivePermissionsRead(names),
});

const datasetRead = (names: readonly string[]): PermissionsReadResult => ({
  evidence: projectedPermissionsRead(names, PROJECTED),
});

const FAILED_PERMISSIONS: PermissionsReadResult = {
  evidence: PERMISSIONS_FAILED,
  failure: { kind: "transient" },
};

const groupsRead = (
  groups: readonly { id: string; name: string; semantics: string[] }[] = GROUPS,
): GroupsReadResult => ({ state: { kind: "read", groups } });

const BROWSE: GroupRoleGrant = {
  groupId: RESEARCH_GROUP_ID,
  role: "dg_ds-browse",
};
const EDIT: GroupRoleGrant = { groupId: RESEARCH_GROUP_ID, role: "dg_ds-edit" };

const known = (grants: readonly GroupRoleGrant[]): RecipientReadResult => ({
  state: { kind: "known", grants },
});
const READ_FAILED: RecipientReadResult = {
  state: { kind: "failed" },
  failure: { kind: "transient", httpStatus: 503 },
};
const READ_REFUSED: RecipientReadResult = {
  state: { kind: "unknown", reason: "not-supported" },
  failure: { kind: "forbidden", httpStatus: 403 },
};

/** A reply the test releases when it chooses. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

interface GatewayOverrides {
  readGlobalPermissions?: DatasetPermissionsGateway["readGlobalPermissions"];
  readDatasetActionPermissions?: DatasetPermissionsGateway["readDatasetActionPermissions"];
  queryGroups?: DatasetPermissionsGateway["queryGroups"];
  readDatasetGroupGrants?: DatasetPermissionsGateway["readDatasetGroupGrants"];
}

const makeGateway = (overrides: GatewayOverrides = {}) => {
  const gateway = {
    readGlobalPermissions: vi.fn(async () => globalRead(ALL_ACTION_NAMES)),
    readDatasetActionPermissions: vi.fn(async () => datasetRead([])),
    queryGroups: vi.fn(async () => groupsRead()),
    readDatasetGroupGrants: vi.fn(async () => known([BROWSE])),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    ...overrides,
  };
  return gateway as DatasetPermissionsGateway & typeof gateway;
};

/** The inventory read as a mock, for sequencing replies. */
const inventoryMock = (gateway: DatasetPermissionsGateway) =>
  gateway.readDatasetGroupGrants as ReturnType<typeof vi.fn>;

const render = (
  gateway: DatasetPermissionsGateway,
  initial: { scope: DatasetAccessScope | null; enabled?: boolean } = {
    scope: SCOPE,
  },
) =>
  renderHook(
    (props: {
      scope: DatasetAccessScope | null;
      gateway: DatasetPermissionsGateway;
      enabled?: boolean;
    }) => useDatasetPermissionsAccess(props),
    { initialProps: { ...initial, gateway } },
  );

const settledView = async (gateway: DatasetPermissionsGateway) => {
  const view = render(gateway);
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
};

const change = (
  overrides: Partial<AcknowledgedChange> = {},
): AcknowledgedChange => ({
  operationId: "op-edit",
  groupId: RESEARCH_GROUP_ID,
  role: "dg_ds-edit",
  action: "assign",
  ...overrides,
});

describe("what is read, and what is not", () => {
  it("reads the inventory once, for exactly this dataset", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);

    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(1);
    expect(inventoryMock(gateway).mock.calls[0][0]).toBe(DATASET_ID);
    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE],
    });
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
    expect(view.result.current.freshness).toBe("current");
  });

  it("gives an ordinary manager the editor without the old global lookup", async () => {
    // No global access permission at all; `dg_ds-manage` carries all three
    // actions through this dataset's context.
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => globalRead(["BrowseDataset"])),
      readDatasetActionPermissions: vi.fn(async () =>
        datasetRead([
          "addusertocontextgrantgroup",
          "removeuserfromcontextgrantgroup",
          "lookupdatasetcontextgrants",
        ]),
      ),
    });
    const view = await settledView(gateway);

    expect(view.result.current.capabilities).toEqual({
      grant: "allowed",
      revoke: "allowed",
      lookupRecipients: "allowed",
    });
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
  });

  it("asks for the inventory even when lookup is confirmed restricted", async () => {
    // The endpoint enforces access; the capability only says what its refusal
    // means. Here it is the confirmed restriction, so grant-only follows.
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () =>
        globalRead([ACCESS_ACTION_NAMES.grant]),
      ),
      readDatasetActionPermissions: vi.fn(async () => datasetRead([])),
      readDatasetGroupGrants: vi.fn(async () => READ_REFUSED),
    });
    const view = await settledView(gateway);

    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(1);
    expect(view.result.current.capabilities.lookupRecipients).toBe(
      "not-permitted",
    );
    expect(view.result.current.mode).toEqual({ kind: "grant-only" });
  });

  it("does not let the obsolete global lookup confirm the new one", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () =>
        globalRead([ACCESS_ACTION_NAMES.grant, "LookupContextGrantOther"]),
      ),
      readDatasetActionPermissions: vi.fn(async () => datasetRead([])),
    });
    const view = await settledView(gateway);
    expect(view.result.current.capabilities.lookupRecipients).toBe(
      "not-permitted",
    );
  });

  it("combines global and dataset-context evidence for a write capability", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => globalRead([])),
      readDatasetActionPermissions: vi.fn(async () =>
        datasetRead([ACCESS_ACTION_NAMES.grant]),
      ),
    });
    const view = await settledView(gateway);
    expect(view.result.current.capabilities.grant).toBe("allowed");
    expect(view.result.current.capabilities.revoke).toBe("not-permitted");
  });

  it("identifies the public audience from semantics only", async () => {
    const view = await settledView(makeGateway());
    expect(view.result.current.everyone).toEqual({
      kind: "identified",
      group: GROUPS[0],
    });
  });

  it("never writes, whatever it reads", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    await act(async () => {
      view.result.current.refreshAccess();
    });
    await act(async () => {
      view.result.current.refreshAfterAcknowledgement([change()]);
    });
    expect(gateway.assignRole).not.toHaveBeenCalled();
    expect(gateway.removeRole).not.toHaveBeenCalled();
  });

  it("issues nothing at all while the flow is disabled", async () => {
    const gateway = makeGateway();
    const view = render(gateway, { scope: SCOPE, enabled: false });

    await act(async () => {});

    expect(gateway.readGlobalPermissions).not.toHaveBeenCalled();
    expect(gateway.queryGroups).not.toHaveBeenCalled();
    expect(gateway.readDatasetGroupGrants).not.toHaveBeenCalled();
    expect(view.result.current.loading).toBe(false);
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "identity-unresolved",
    });

    // And a refresh from the inert hook reads nothing either.
    act(() => view.result.current.refreshAccess());
    expect(gateway.readDatasetGroupGrants).not.toHaveBeenCalled();
  });

  it("issues nothing while the scope is unresolved", async () => {
    const gateway = makeGateway();
    render(gateway, { scope: null });
    await act(async () => {});
    expect(gateway.readGlobalPermissions).not.toHaveBeenCalled();
    expect(gateway.readDatasetGroupGrants).not.toHaveBeenCalled();
  });
});

describe("independent reads", () => {
  it("keeps a successful inventory when group discovery fails", async () => {
    const gateway = makeGateway({
      queryGroups: vi.fn(async () => ({ state: { kind: "failed" as const } })),
      readDatasetGroupGrants: vi.fn(async () =>
        known([{ groupId: UNDISCOVERED_GROUP_ID, role: "dg_ds-browse" }]),
      ),
    });
    const view = await settledView(gateway);

    expect(view.result.current.groups).toEqual({ kind: "failed" });
    expect(view.result.current.recipients.kind).toBe("known");
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
    expect(view.result.current.everyone).toEqual({
      kind: "unavailable",
      reason: "groups-unknown",
    });
  });

  it("keeps the inventory when discovery returns no group at all", async () => {
    const gateway = makeGateway({
      queryGroups: vi.fn(async () => groupsRead([])),
    });
    const view = await settledView(gateway);
    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE],
    });
  });

  it("does not wait for the capability reads to issue the inventory read", async () => {
    const pending = deferred<PermissionsReadResult>();
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(() => pending.promise),
    });
    const view = render(gateway);
    await act(async () => {});

    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(1);
    expect(gateway.queryGroups).toHaveBeenCalledTimes(1);
    // Nothing is presented until every read on open has settled.
    expect(view.result.current.loading).toBe(true);

    await act(async () => pending.resolve(globalRead(ALL_ACTION_NAMES)));
    expect(view.result.current.loading).toBe(false);
  });
});

describe("incomplete and failed reads", () => {
  it("reports a failed inventory read as failed, never empty", async () => {
    const gateway = makeGateway({
      readDatasetGroupGrants: vi.fn(async () => READ_FAILED),
    });
    const view = await settledView(gateway);

    expect(view.result.current.recipients).toEqual({ kind: "failed" });
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "recipient-read-failed",
    });
  });

  it("treats a refusal with an allowed lookup as a mismatch, not policy", async () => {
    const gateway = makeGateway({
      readDatasetGroupGrants: vi.fn(async () => READ_REFUSED),
    });
    const view = await settledView(gateway);
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "recipient-read-refused",
    });
  });

  it("treats a refusal with an unknown lookup as a mismatch, not policy", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => FAILED_PERMISSIONS),
      readDatasetActionPermissions: vi.fn(async () =>
        datasetRead([ACCESS_ACTION_NAMES.grant]),
      ),
      readDatasetGroupGrants: vi.fn(async () => READ_REFUSED),
    });
    const view = await settledView(gateway);

    // Grant capability is positively established and the read came back
    // refused — the shape of the grant-only case. It is still refused, because
    // the restriction was never *confirmed*: the global read failed.
    expect(view.result.current.capabilities.grant).toBe("allowed");
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "recipient-read-refused",
    });
  });

  it("shows a successful inventory when the capability reads failed, and offers no writes", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => FAILED_PERMISSIONS),
      readDatasetActionPermissions: vi.fn(async () => FAILED_PERMISSIONS),
    });
    const view = await settledView(gateway);

    // The read succeeding *is* the evidence for showing the inventory.
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
    // Missing evidence never becomes permission.
    expect(view.result.current.capabilities).toEqual({
      grant: "unknown",
      revoke: "unknown",
      lookupRecipients: "unknown",
    });
  });
});

describe("Refresh access", () => {
  it("reads only the inventory again: one GET, nothing else", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);

    await act(async () => view.result.current.refreshAccess());

    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(2);
    expect(gateway.readGlobalPermissions).toHaveBeenCalledTimes(1);
    expect(gateway.readDatasetActionPermissions).toHaveBeenCalledTimes(1);
    expect(gateway.queryGroups).toHaveBeenCalledTimes(1);
  });

  it("recovers from a failed read on open", async () => {
    const gateway = makeGateway({
      readDatasetGroupGrants: vi
        .fn()
        .mockResolvedValueOnce(READ_FAILED)
        .mockResolvedValue(known([BROWSE])),
    });
    const view = await settledView(gateway);
    expect(view.result.current.mode.kind).toBe("unavailable");

    await act(async () => view.result.current.refreshAccess());

    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
    expect(view.result.current.freshness).toBe("current");
  });

  it("shows last-known roles while refreshing", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const pending = deferred<RecipientReadResult>();
    inventoryMock(gateway).mockReturnValueOnce(pending.promise);

    act(() => view.result.current.refreshAccess());

    expect(view.result.current.freshness).toBe("refreshing");
    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE],
    });

    await act(async () => pending.resolve(known([BROWSE, EDIT])));
    expect(view.result.current.freshness).toBe("current");
    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE, EDIT],
    });
  });

  it("keeps the last-known inventory, marked stale, when a refresh fails", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const before = view.result.current.recipients;
    inventoryMock(gateway).mockResolvedValueOnce(READ_FAILED);

    await act(async () => view.result.current.refreshAccess());

    // Dropping it would turn a transient failure into "nobody has access";
    // replacing it with an empty list would look like a rollback.
    expect(view.result.current.recipients).toBe(before);
    expect(view.result.current.freshness).toBe("stale");
    expect(view.result.current.staleReason).toBe("refresh-failed");
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
  });

  it("does nothing while the read on open is still settling", async () => {
    const pending = deferred<RecipientReadResult>();
    const gateway = makeGateway({
      readDatasetGroupGrants: vi.fn(() => pending.promise),
    });
    const view = render(gateway);
    await act(async () => {});

    act(() => view.result.current.refreshAccess());
    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(known([BROWSE])));
    expect(view.result.current.recipients.kind).toBe("known");
  });
});

describe("ordering", () => {
  it("never lets an older read replace a newer one, whichever replies first", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const first = deferred<RecipientReadResult>();
    const second = deferred<RecipientReadResult>();
    inventoryMock(gateway)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    act(() => view.result.current.refreshAccess());
    act(() => view.result.current.refreshAccess());

    // Reversed replies: the newer lands first, then the older.
    await act(async () => second.resolve(known([BROWSE, EDIT])));
    const revision = view.result.current.inventoryRevision;
    await act(async () => first.resolve(known([])));

    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE, EDIT],
    });
    expect(view.result.current.inventoryRevision).toBe(revision);
    expect(view.result.current.freshness).toBe("current");
  });

  it("cancels the older read when a newer one starts", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const first = deferred<RecipientReadResult>();
    inventoryMock(gateway)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(known([BROWSE]));

    act(() => view.result.current.refreshAccess());
    const firstSignal = inventoryMock(gateway).mock.calls[1][1] as AbortSignal;
    await act(async () => view.result.current.refreshAccess());

    expect(firstSignal.aborted).toBe(true);
  });

  it("does not let a refresh launched before an acknowledgement overwrite its read", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const beforeAck = deferred<RecipientReadResult>();
    const afterAck = deferred<RecipientReadResult>();
    inventoryMock(gateway)
      .mockReturnValueOnce(beforeAck.promise)
      .mockReturnValueOnce(afterAck.promise);

    act(() => view.result.current.refreshAccess());
    act(() => view.result.current.refreshAfterAcknowledgement([change()]));

    await act(async () => afterAck.resolve(known([BROWSE, EDIT])));
    // The pre-acknowledgement read lands last and shows the old state.
    await act(async () => beforeAck.resolve(known([BROWSE])));

    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE, EDIT],
    });
    expect(view.result.current.freshness).toBe("current");
    expect(view.result.current.confirmedOperationIds.has("op-edit")).toBe(true);
  });

  it("checks two acknowledged changes against the newest read only", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const firstRead = deferred<RecipientReadResult>();
    const secondRead = deferred<RecipientReadResult>();
    inventoryMock(gateway)
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);

    act(() =>
      view.result.current.refreshAfterAcknowledgement([
        change({ operationId: "a" }),
      ]),
    );
    act(() =>
      view.result.current.refreshAfterAcknowledgement([
        change({ operationId: "b", role: "dg_ds-download" }),
      ]),
    );

    await act(async () =>
      secondRead.resolve(
        known([
          BROWSE,
          EDIT,
          { groupId: RESEARCH_GROUP_ID, role: "dg_ds-download" },
        ]),
      ),
    );
    await act(async () => firstRead.resolve(known([BROWSE, EDIT])));

    expect(view.result.current.confirmedOperationIds).toEqual(
      new Set(["a", "b"]),
    );
    expect(view.result.current.freshness).toBe("current");
    // Two acknowledgements, two reads, no write and no per-group read.
    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(3);
    expect(gateway.assignRole).not.toHaveBeenCalled();
  });
});

describe("acknowledged changes", () => {
  it("confirms a change the following read agrees with", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    inventoryMock(gateway).mockResolvedValueOnce(known([BROWSE, EDIT]));

    await act(async () =>
      view.result.current.refreshAfterAcknowledgement([change()]),
    );

    expect(view.result.current.confirmedOperationIds.has("op-edit")).toBe(true);
    expect(view.result.current.freshness).toBe("current");
  });

  it("confirms a removal by the role's absence", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    inventoryMock(gateway).mockResolvedValueOnce(known([]));

    await act(async () =>
      view.result.current.refreshAfterAcknowledgement([
        change({ operationId: "rm", role: "dg_ds-browse", action: "remove" }),
      ]),
    );

    expect(view.result.current.confirmedOperationIds.has("rm")).toBe(true);
  });

  it("leaves a contradicted change unconfirmed and the inventory stale", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    // The read after "assign Edit" does not show Edit.
    inventoryMock(gateway).mockResolvedValueOnce(known([BROWSE]));

    await act(async () =>
      view.result.current.refreshAfterAcknowledgement([change()]),
    );

    expect(view.result.current.confirmedOperationIds.has("op-edit")).toBe(
      false,
    );
    expect(view.result.current.freshness).toBe("stale");
    expect(view.result.current.staleReason).toBe("change-unconfirmed");
  });

  it("keeps the inventory and says the change is unconfirmed when its read fails", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const before = view.result.current.recipients;
    inventoryMock(gateway).mockResolvedValueOnce(READ_FAILED);

    await act(async () =>
      view.result.current.refreshAfterAcknowledgement([change()]),
    );

    expect(view.result.current.recipients).toBe(before);
    expect(view.result.current.staleReason).toBe("change-unconfirmed");
  });

  it("confirms a pending change on a later successful Refresh access", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    inventoryMock(gateway)
      .mockResolvedValueOnce(READ_FAILED)
      .mockResolvedValueOnce(known([BROWSE, EDIT]));

    await act(async () =>
      view.result.current.refreshAfterAcknowledgement([change()]),
    );
    expect(view.result.current.freshness).toBe("stale");

    await act(async () => view.result.current.refreshAccess());
    expect(view.result.current.freshness).toBe("current");
    expect(view.result.current.confirmedOperationIds.has("op-edit")).toBe(true);
  });

  it("does not read again after an acknowledgement in the grant-only form", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () =>
        globalRead([ACCESS_ACTION_NAMES.grant]),
      ),
      readDatasetGroupGrants: vi.fn(async () => READ_REFUSED),
    });
    const view = await settledView(gateway);
    expect(view.result.current.mode).toEqual({ kind: "grant-only" });

    await act(async () =>
      view.result.current.refreshAfterAcknowledgement([change()]),
    );
    // The restriction is confirmed: asking again would spend a refusal.
    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(1);
  });
});

describe("ownership and isolation", () => {
  it("drops a read that lands after the account changed", async () => {
    let releaseFirst: (() => void) | null = null;
    const readGlobalPermissions = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PermissionsReadResult>((resolve) => {
            releaseFirst = () => resolve(globalRead(ALL_ACTION_NAMES));
          }),
      )
      .mockImplementation(async () => globalRead([]));

    const gateway = makeGateway({ readGlobalPermissions });
    const view = render(gateway);

    view.rerender({ scope: OTHER_ACCOUNT, gateway });
    await act(async () => {
      releaseFirst?.();
    });
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // The second owner's answer is the one on screen; the first's is dropped.
    expect(view.result.current.capabilities.lookupRecipients).toBe(
      "not-permitted",
    );
  });

  it("cancels the previous owner's reads, the inventory included", async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const inventory = deferred<RecipientReadResult>();
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async (signal?: AbortSignal) => {
        signals.push(signal);
        return globalRead(ALL_ACTION_NAMES);
      }),
      readDatasetGroupGrants: vi.fn(() => inventory.promise),
    });
    const view = render(gateway);
    await act(async () => {});
    const inventorySignal = inventoryMock(gateway).mock
      .calls[0][1] as AbortSignal;

    view.rerender({
      scope: { ...SCOPE, datasetId: OTHER_DATASET_ID },
      gateway,
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(inventorySignal.aborted).toBe(true);
  });

  it("clears the previous owner's recipients on the render that changes owner", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    expect(view.result.current.recipients.kind).toBe("known");

    view.rerender({ scope: OTHER_ACCOUNT, gateway });

    // Not in a later effect: one painted frame of the previous principal's
    // recipients is exactly what isolation forbids.
    expect(view.result.current.recipients).toEqual({
      kind: "unknown",
      reason: "not-read",
    });
    expect(view.result.current.loading).toBe(true);
  });

  it("starts a fresh read for a textually identical A → unavailable → A", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);

    view.rerender({ scope: null, gateway });
    view.rerender({ scope: { ...SCOPE }, gateway });
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(gateway.readGlobalPermissions).toHaveBeenCalledTimes(2);
    expect(gateway.readDatasetGroupGrants).toHaveBeenCalledTimes(2);
  });

  it("drops a refresh from the first A when it lands in the second A", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const late = deferred<RecipientReadResult>();
    inventoryMock(gateway).mockReturnValueOnce(late.promise);

    act(() => view.result.current.refreshAccess());
    view.rerender({ scope: null, gateway });
    view.rerender({ scope: { ...SCOPE }, gateway });
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(async () =>
      late.resolve(known([{ groupId: SECOND_GROUP_ID, role: "dg_ds-manage" }])),
    );

    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [BROWSE],
    });
  });

  it("ignores a refresh action kept from a replaced owner", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const keptRefresh = view.result.current.refreshAccess;
    const keptAcknowledge = view.result.current.refreshAfterAcknowledgement;

    view.rerender({ scope: OTHER_ACCOUNT, gateway });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const calls = inventoryMock(gateway).mock.calls.length;

    act(() => keptRefresh());
    act(() => keptAcknowledge([change()]));

    expect(inventoryMock(gateway).mock.calls.length).toBe(calls);
  });

  it("forgets the previous owner's expectations", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);
    const lost = deferred<RecipientReadResult>();
    inventoryMock(gateway).mockReturnValueOnce(lost.promise);
    act(() => view.result.current.refreshAfterAcknowledgement([change()]));

    view.rerender({ scope: OTHER_ACCOUNT, gateway });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    // A read for the new owner that lacks the old owner's change is current,
    // not a contradiction of somebody else's acknowledgement.
    await act(async () => view.result.current.refreshAccess());

    expect(view.result.current.freshness).toBe("current");
  });

  it("does not re-read after a same-principal token refresh", async () => {
    const gateway = makeGateway();
    const view = await settledView(gateway);

    // A refreshed token hands over a *new gateway object* for the same
    // account. That is not an owner change.
    const refreshed = makeGateway();
    view.rerender({ scope: { ...SCOPE }, gateway: refreshed });

    expect(refreshed.readGlobalPermissions).not.toHaveBeenCalled();
    expect(refreshed.readDatasetGroupGrants).not.toHaveBeenCalled();
    expect(view.result.current.recipients.kind).toBe("known");
    expect(view.result.current.loading).toBe(false);
  });
});
