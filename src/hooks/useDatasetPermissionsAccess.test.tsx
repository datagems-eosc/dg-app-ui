import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DATASET_ID,
  EVERYONE_GROUP_ID,
  OTHER_DATASET_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
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
import { ACCESS_ACTION_NAMES } from "@/lib/datasetPermissions/types";
import {
  type DatasetAccessScope,
  useDatasetPermissionsAccess,
} from "./useDatasetPermissionsAccess";

/**
 * The read side, with the adapter faked at its own boundary.
 *
 * Nothing here touches the network: the gateway is an object of `vi.fn()`s
 * returning the adapter's own result types, so what is under test is the
 * orchestration — what is asked for, in what order, whose answer it is, and
 * what is deliberately *not* asked for.
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

const globalRead = (names: readonly string[]): PermissionsReadResult => ({
  evidence: exhaustivePermissionsRead(names),
});

const datasetRead = (names: readonly string[]): PermissionsReadResult => ({
  evidence: projectedPermissionsRead(names, [
    ACCESS_ACTION_NAMES.grant,
    ACCESS_ACTION_NAMES.revoke,
  ]),
});

const groupsRead = (
  groups: readonly { id: string; name: string; semantics: string[] }[] = GROUPS,
): GroupsReadResult => ({ state: { kind: "read", groups } });

const grantsFor = (groupId: string): RecipientReadResult => ({
  state: {
    kind: "known",
    grants:
      groupId === RESEARCH_GROUP_ID ? [{ groupId, role: "dg_ds-browse" }] : [],
  },
});

interface GatewayOverrides {
  readGlobalPermissions?: DatasetPermissionsGateway["readGlobalPermissions"];
  readDatasetActionPermissions?: DatasetPermissionsGateway["readDatasetActionPermissions"];
  queryGroups?: DatasetPermissionsGateway["queryGroups"];
  readGroupDatasetGrants?: DatasetPermissionsGateway["readGroupDatasetGrants"];
}

const makeGateway = (overrides: GatewayOverrides = {}) => {
  const gateway: DatasetPermissionsGateway = {
    readGlobalPermissions: vi.fn(async () => globalRead(ALL_ACTION_NAMES)),
    readDatasetActionPermissions: vi.fn(async () => datasetRead([])),
    queryGroups: vi.fn(async () => groupsRead()),
    readGroupDatasetGrants: vi.fn(async (groupId: string) =>
      grantsFor(groupId),
    ),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    ...overrides,
  };
  return gateway;
};

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

describe("what is read, and what is not", () => {
  it("decides each capability separately and reads recipients per group", async () => {
    const gateway = makeGateway();
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.capabilities).toEqual({
      grant: "allowed",
      revoke: "allowed",
      lookupRecipients: "allowed",
    });
    expect(gateway.readGroupDatasetGrants).toHaveBeenCalledTimes(GROUPS.length);
    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [{ groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" }],
    });
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
  });

  it("does not ask about recipients once a complete global read says lookup is refused", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () =>
        globalRead([ACCESS_ACTION_NAMES.grant]),
      ),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // A refusal per group would spend requests learning something already
    // known from the exhaustive global read.
    expect(gateway.readGroupDatasetGrants).not.toHaveBeenCalled();
    expect(view.result.current.capabilities.lookupRecipients).toBe(
      "not-permitted",
    );
    expect(view.result.current.mode).toEqual({ kind: "grant-only" });
  });

  it("decides recipient lookup from the global read alone", async () => {
    // `ContextGrantsDatasetGroupOther` calls plain `AuthorizeForce`, with no
    // affiliated-context alternative, so a dataset projection cannot answer
    // it — and must not be allowed to contribute a false negative.
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => globalRead(ALL_ACTION_NAMES)),
      readDatasetActionPermissions: vi.fn(async () => datasetRead([])),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.capabilities.lookupRecipients).toBe("allowed");
  });

  it("combines global and dataset-context evidence for a write capability", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => globalRead([])),
      readDatasetActionPermissions: vi.fn(async () =>
        datasetRead([ACCESS_ACTION_NAMES.grant]),
      ),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.capabilities.grant).toBe("allowed");
    expect(view.result.current.capabilities.revoke).toBe("not-permitted");
  });

  it("identifies the public audience from semantics only", async () => {
    const view = render(makeGateway());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.everyone).toEqual({
      kind: "identified",
      group: GROUPS[0],
    });
  });

  it("issues nothing at all while the flow is disabled", async () => {
    const gateway = makeGateway();
    const view = render(gateway, { scope: SCOPE, enabled: false });

    await act(async () => {});

    expect(gateway.readGlobalPermissions).not.toHaveBeenCalled();
    expect(gateway.queryGroups).not.toHaveBeenCalled();
    expect(view.result.current.loading).toBe(false);
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "identity-unresolved",
    });
  });

  it("issues nothing while the scope is unresolved", async () => {
    const gateway = makeGateway();
    render(gateway, { scope: null });
    await act(async () => {});
    expect(gateway.readGlobalPermissions).not.toHaveBeenCalled();
  });
});

describe("incomplete and failed reads", () => {
  it("reports a failure when any one group's grants cannot be read", async () => {
    const gateway = makeGateway({
      readGroupDatasetGrants: vi.fn(async (groupId: string) =>
        groupId === RESEARCH_GROUP_ID
          ? ({ state: { kind: "failed" } } as RecipientReadResult)
          : grantsFor(groupId),
      ),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // A partial assembly is a list missing whichever groups failed, which on
    // screen is indistinguishable from those groups holding nothing.
    expect(view.result.current.recipients).toEqual({ kind: "failed" });
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "recipient-read-failed",
    });
  });

  it("keeps a refused recipient read refused rather than failed", async () => {
    const gateway = makeGateway({
      readGroupDatasetGrants: vi.fn(async () => ({
        state: { kind: "unknown", reason: "not-supported" },
        failure: { kind: "forbidden", httpStatus: 403 },
      })) as DatasetPermissionsGateway["readGroupDatasetGrants"],
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // The caller's lookup capability was established as allowed, so this is an
    // unexpected refusal, not a policy that selects the grant-only form.
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "recipient-read-refused",
    });
  });

  it("still reads recipients when the capability read failed, and offers no writes", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => ({
        evidence: PERMISSIONS_FAILED,
        failure: { kind: "transient" as const },
      })),
      readDatasetActionPermissions: vi.fn(async () => datasetRead([])),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // A failed capability read is not a confirmed restriction, so the recipient
    // read is still attempted — and succeeding at it *is* the evidence for the
    // full editor, whatever the capability read said.
    expect(gateway.readGroupDatasetGrants).toHaveBeenCalledTimes(GROUPS.length);
    expect(view.result.current.mode).toEqual({ kind: "full-editor" });
    // Nothing may be written, though: missing evidence never becomes
    // permission.
    expect(view.result.current.capabilities).toEqual({
      grant: "unknown",
      revoke: "unknown",
      lookupRecipients: "unknown",
    });
  });

  it("does not select grant-only when a failed capability read meets a refusal", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () => ({
        evidence: PERMISSIONS_FAILED,
        failure: { kind: "transient" as const },
      })),
      readDatasetActionPermissions: vi.fn(async () =>
        datasetRead([ACCESS_ACTION_NAMES.grant]),
      ),
      readGroupDatasetGrants: vi.fn(async () => ({
        state: { kind: "unknown", reason: "not-supported" },
        failure: { kind: "forbidden", httpStatus: 403 },
      })) as DatasetPermissionsGateway["readGroupDatasetGrants"],
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // Grant capability is positively established, and the recipient read came
    // back refused — the shape of the grant-only case. It is still refused,
    // because the restriction was never *confirmed*: the global read failed.
    expect(view.result.current.capabilities.grant).toBe("allowed");
    expect(view.result.current.mode).toEqual({
      kind: "unavailable",
      reason: "recipient-read-refused",
    });
  });

  it("does not read grants when no group came back", async () => {
    const gateway = makeGateway({
      queryGroups: vi.fn(async () => groupsRead([])),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(gateway.readGroupDatasetGrants).not.toHaveBeenCalled();
    expect(view.result.current.recipients).toEqual({
      kind: "unknown",
      reason: "not-read",
    });
  });

  it("keeps a failed group read out of the Everyone decision", async () => {
    const gateway = makeGateway({
      queryGroups: vi.fn(async () => ({ state: { kind: "failed" as const } })),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.everyone).toEqual({
      kind: "unavailable",
      reason: "groups-unknown",
    });
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

  it("cancels the previous owner's reads", async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async (signal?: AbortSignal) => {
        signals.push(signal);
        return globalRead(ALL_ACTION_NAMES);
      }),
    });
    const view = render(gateway);

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    view.rerender({
      scope: { ...SCOPE, datasetId: OTHER_DATASET_ID },
      gateway,
    });

    expect(signals[0]?.aborted).toBe(true);
  });

  it("clears the previous owner's recipients on the render that changes owner", async () => {
    const gateway = makeGateway();
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));
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
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    view.rerender({ scope: null, gateway });
    view.rerender({ scope: { ...SCOPE }, gateway });
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(gateway.readGlobalPermissions).toHaveBeenCalledTimes(2);
  });

  it("does not re-read after a same-principal token refresh", async () => {
    const gateway = makeGateway();
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    // A refreshed token hands over a *new gateway object* for the same
    // account. That is not an owner change.
    const refreshed = makeGateway();
    view.rerender({ scope: { ...SCOPE }, gateway: refreshed });

    expect(refreshed.readGlobalPermissions).not.toHaveBeenCalled();
    expect(view.result.current.recipients.kind).toBe("known");
    expect(view.result.current.loading).toBe(false);
  });
});

describe("read-after-write reconciliation", () => {
  it("refreshes one group's baseline without disturbing the others", async () => {
    const gateway = makeGateway();
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    (
      gateway.readGroupDatasetGrants as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      state: {
        kind: "known",
        grants: [
          { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
          { groupId: RESEARCH_GROUP_ID, role: "dg_ds-edit" },
        ],
      },
    });

    await act(async () => {
      view.result.current.reconcileGroup(RESEARCH_GROUP_ID);
    });

    expect(view.result.current.recipients).toEqual({
      kind: "known",
      grants: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-edit" },
      ],
    });
    expect(view.result.current.reconciliationFailed).toBe(false);
  });

  it("keeps what is known when the re-check fails, and says so", async () => {
    const gateway = makeGateway();
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const before = view.result.current.recipients;

    (
      gateway.readGroupDatasetGrants as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ state: { kind: "failed" } });

    await act(async () => {
      view.result.current.reconcileGroup(RESEARCH_GROUP_ID);
    });

    // Dropping it would turn a transient failure into "nobody has access";
    // replacing it with an empty list would look like a rollback.
    expect(view.result.current.recipients).toEqual(before);
    expect(view.result.current.reconciliationFailed).toBe(true);
  });

  it("does not re-check where recipient lookup is not supported", async () => {
    const gateway = makeGateway({
      readGlobalPermissions: vi.fn(async () =>
        globalRead([ACCESS_ACTION_NAMES.grant]),
      ),
    });
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(async () => {
      view.result.current.reconcileGroup(RESEARCH_GROUP_ID);
    });

    expect(gateway.readGroupDatasetGrants).not.toHaveBeenCalled();
  });

  it("drops a re-check that lands after the owner changed", async () => {
    const gateway = makeGateway();
    const view = render(gateway);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    let release: (() => void) | null = null;
    (
      gateway.readGroupDatasetGrants as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              state: {
                kind: "known",
                grants: [{ groupId: SECOND_GROUP_ID, role: "dg_ds-manage" }],
              },
            });
        }),
    );

    act(() => {
      view.result.current.reconcileGroup(RESEARCH_GROUP_ID);
    });
    view.rerender({ scope: OTHER_ACCOUNT, gateway });
    await act(async () => {
      release?.();
    });

    expect(
      view.result.current.recipients.kind === "known"
        ? view.result.current.recipients.grants
        : null,
    ).not.toContainEqual({ groupId: SECOND_GROUP_ID, role: "dg_ds-manage" });
  });
});
