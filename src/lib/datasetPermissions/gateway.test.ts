import { describe, expect, it, vi } from "vitest";
import {
  currentAdminAccountPayload,
  currentGroupQueryPayload,
  currentManagerAccountPayload,
  DATASET_ID,
  datasetActionsAbsentPayload,
  datasetActionsDeniedPayload,
  datasetActionsGrantedPayload,
  datasetGrantsEmptyPayload,
  datasetGrantsPayload,
  datasetGrantsUnusablePayloads,
  datasetManagerActionsPayload,
  deniedRecipientReadStatus,
  EVERYONE_GROUP_ID,
  RESEARCH_GROUP_ID,
} from "./fixtures";
import { createDatasetPermissionsGateway } from "./gateway";
import { decideAction } from "./model";
import type { DatasetRoleOperation } from "./types";

/**
 * No network anywhere in this file. The adapter's contract is the injected
 * transport, and every assertion is about what it is asked for and how the
 * answer is classified.
 *
 * Nothing here is evidence that the endpoints behave this way in a deployment.
 * The status classification is derived from the pinned Gateway source and is
 * documented where it is implemented; PM-05 and task 4.3 own the live check.
 */

interface Call {
  path: string;
  init: RequestInit;
  policy?: { retryOn401?: boolean; expectedPrincipalId?: string };
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const statusResponse = (status: number): Response =>
  new Response(null, { status });

const recorder = (responder: (call: Call) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const request = vi.fn(
    async (path: string, init: RequestInit, policy?: Call["policy"]) => {
      const call: Call = { path, init, policy };
      calls.push(call);
      return responder(call);
    },
  );
  return { calls, request };
};

const OPERATION: DatasetRoleOperation = Object.freeze({
  operationId: "op-1",
  datasetId: DATASET_ID,
  groupId: RESEARCH_GROUP_ID,
  role: "dg_ds-browse",
  action: "assign",
});

describe("read contracts", () => {
  it("reads global permissions as exhaustive evidence", async () => {
    const { calls, request } = recorder(() =>
      jsonResponse(currentAdminAccountPayload),
    );
    const gateway = createDatasetPermissionsGateway(request);

    const result = await gateway.readGlobalPermissions();

    expect(calls[0].path).toBe("/principal/me?f=permissions");
    expect(result.evidence).toEqual({
      kind: "read",
      names: currentAdminAccountPayload.permissions,
      coverage: { kind: "exhaustive" },
    });
  });

  it("never reads deferred permissions into the evidence", async () => {
    const { request } = recorder(() =>
      jsonResponse(currentAdminAccountPayload),
    );
    const result =
      await createDatasetPermissionsGateway(request).readGlobalPermissions();

    if (result.evidence.kind !== "read") throw new Error("expected a read");
    expect(result.evidence.names).not.toContain("DeleteDataset");
  });

  it("projects the exact action permission names for one dataset", async () => {
    const { calls, request } = recorder(() =>
      jsonResponse(datasetActionsGrantedPayload),
    );
    const gateway = createDatasetPermissionsGateway(request);

    const result = await gateway.readDatasetActionPermissions(DATASET_ID);

    expect(calls[0].path).toBe(
      `/dataset/${DATASET_ID}?f=id&f=permissions.addUserToContextGrantGroup` +
        "&f=permissions.removeUserFromContextGrantGroup" +
        "&f=permissions.lookupDatasetContextGrants",
    );
    // The requested set travels with the evidence: that is the F3 fix.
    expect(result.evidence).toEqual({
      kind: "read",
      names: datasetActionsGrantedPayload.permissions,
      coverage: {
        kind: "projected",
        requested: [
          "AddUserToContextGrantGroup",
          "RemoveUserFromContextGrantGroup",
          "LookupDatasetContextGrants",
        ],
      },
    });
  });

  it("lets a dataset manager's projection support the recipient lookup", async () => {
    const dataset = await createDatasetPermissionsGateway(
      recorder(() => jsonResponse(datasetManagerActionsPayload)).request,
    ).readDatasetActionPermissions(DATASET_ID);
    const global = await createDatasetPermissionsGateway(
      recorder(() => jsonResponse(currentManagerAccountPayload)).request,
    ).readGlobalPermissions();

    // No global lookup permission at all, and the manager may still read.
    expect(
      decideAction("lookupRecipients", {
        global: global.evidence,
        datasetContext: dataset.evidence,
      }),
    ).toBe("allowed");
  });

  it("does not count the obsolete global-only lookup as the new one", async () => {
    const global = await createDatasetPermissionsGateway(
      recorder(() => jsonResponse({ permissions: ["LookupContextGrantOther"] }))
        .request,
    ).readGlobalPermissions();
    const dataset = await createDatasetPermissionsGateway(
      recorder(() => jsonResponse(datasetActionsDeniedPayload)).request,
    ).readDatasetActionPermissions(DATASET_ID);

    expect(
      decideAction("lookupRecipients", {
        global: global.evidence,
        datasetContext: dataset.evidence,
      }),
    ).toBe("not-permitted");
  });

  it("supports a negative only for the names it asked about", async () => {
    const { request } = recorder(() =>
      jsonResponse(datasetActionsDeniedPayload),
    );
    const dataset =
      await createDatasetPermissionsGateway(
        request,
      ).readDatasetActionPermissions(DATASET_ID);

    const { request: accountRequest } = recorder(() =>
      jsonResponse(currentManagerAccountPayload),
    );
    const global =
      await createDatasetPermissionsGateway(
        accountRequest,
      ).readGlobalPermissions();

    expect(
      decideAction("grant", {
        global: global.evidence,
        datasetContext: dataset.evidence,
      }),
    ).toBe("not-permitted");
  });

  it("leaves an absent permissions field unreadable, not empty", async () => {
    const { request } = recorder(() =>
      jsonResponse(datasetActionsAbsentPayload),
    );
    const result =
      await createDatasetPermissionsGateway(
        request,
      ).readDatasetActionPermissions(DATASET_ID);

    expect(result.evidence).toEqual({ kind: "not-read" });
  });

  it("turns a failed read into failed evidence, never an empty one", async () => {
    const { request } = recorder(() => statusResponse(503));
    const result =
      await createDatasetPermissionsGateway(request).readGlobalPermissions();

    expect(result.evidence).toEqual({ kind: "failed" });
    expect(result.failure).toEqual({ kind: "transient", httpStatus: 503 });

    // A failed branch beside a silent one cannot refuse anything.
    expect(
      decideAction("grant", {
        global: result.evidence,
        datasetContext: { kind: "not-read" },
      }),
    ).toBe("unknown");
  });

  it("queries groups with the semantics projection", async () => {
    const { calls, request } = recorder(() =>
      jsonResponse(currentGroupQueryPayload),
    );
    const result = await createDatasetPermissionsGateway(request).queryGroups();

    expect(calls[0].path).toBe("/user/group/query");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      project: { fields: ["id", "name", "semantics"] },
    });
    expect(result.state.kind).toBe("read");
  });

  it("reads one dataset's inventory with one encoded GET", async () => {
    const { calls, request } = recorder(() =>
      jsonResponse(datasetGrantsPayload),
    );
    const result =
      await createDatasetPermissionsGateway(request).readDatasetGroupGrants(
        DATASET_ID,
      );

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(
      `/principal/context-grants/dataset?id=${DATASET_ID}`,
    );
    expect(calls[0].init.method).toBe("GET");
    expect(result.state).toEqual({
      kind: "known",
      grants: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-download" },
        { groupId: EVERYONE_GROUP_ID, role: "dg_ds-browse" },
      ],
    });
  });

  it("encodes the dataset id as one query value", async () => {
    const { calls, request } = recorder(() => jsonResponse([]));
    await createDatasetPermissionsGateway(request).readDatasetGroupGrants(
      "a b&id=other",
    );
    expect(calls[0].path).toBe(
      "/principal/context-grants/dataset?id=a%20b%26id%3Dother",
    );
  });

  it("keeps an explicit empty group list as known, not failed", async () => {
    const { request } = recorder(() => jsonResponse(datasetGrantsEmptyPayload));
    const result =
      await createDatasetPermissionsGateway(request).readDatasetGroupGrants(
        DATASET_ID,
      );
    expect(result.state).toEqual({ kind: "known", grants: [] });
  });

  it("reports every unusable inventory as failed, never as empty", async () => {
    for (const payload of Object.values(datasetGrantsUnusablePayloads)) {
      const { request } = recorder(() => jsonResponse(payload));
      const result =
        await createDatasetPermissionsGateway(request).readDatasetGroupGrants(
          DATASET_ID,
        );
      expect(result.state).toEqual({ kind: "failed" });
      expect(result.failure).toMatchObject({ kind: "malformed" });
    }
  });

  it("keeps a refused inventory read unsupported rather than empty", async () => {
    const { request } = recorder(() =>
      statusResponse(deniedRecipientReadStatus),
    );
    const result =
      await createDatasetPermissionsGateway(request).readDatasetGroupGrants(
        DATASET_ID,
      );

    // Whether this is the confirmed restriction is the mode selector's call,
    // from capability evidence. Here it is only "not supported", never empty.
    expect(result.state).toEqual({ kind: "unknown", reason: "not-supported" });
    expect(result.failure).toEqual({ kind: "forbidden", httpStatus: 403 });
  });

  it.each([401, 404, 405, 500, 503])(
    "reads a %i as failed, with no second request of any kind",
    async (status) => {
      const { calls, request } = recorder(() => statusResponse(status));
      const result =
        await createDatasetPermissionsGateway(request).readDatasetGroupGrants(
          DATASET_ID,
        );
      expect(result.state).toEqual({ kind: "failed" });
      // No per-group fallback, no retry: the one call is the whole read.
      expect(calls).toHaveLength(1);
    },
  );

  it("reads a lost response as failed and a cancelled one as cancelled", async () => {
    const lost = await createDatasetPermissionsGateway(async () => {
      throw new TypeError("Failed to fetch");
    }).readDatasetGroupGrants(DATASET_ID);
    expect(lost).toEqual({
      state: { kind: "failed" },
      failure: { kind: "transient" },
    });

    const cancelled = await createDatasetPermissionsGateway(async () => {
      throw new DOMException("aborted", "AbortError");
    }).readDatasetGroupGrants(DATASET_ID);
    expect(cancelled.state).toEqual({ kind: "failed" });
    expect(cancelled.failure).toEqual({ kind: "cancelled" });
  });

  it("passes the principal-checked refresh policy and the signal to the inventory read", async () => {
    const { calls, request } = recorder(() =>
      jsonResponse(datasetGrantsPayload),
    );
    const controller = new AbortController();
    await createDatasetPermissionsGateway(request, {
      expectedPrincipalId: "principal-1",
    }).readDatasetGroupGrants(DATASET_ID, controller.signal);
    expect(calls[0].policy).toEqual({
      retryOn401: true,
      expectedPrincipalId: "principal-1",
    });
    expect(calls[0].init.signal).toBe(controller.signal);
  });

  it("exposes no per-group recipient read at all", () => {
    const gateway = createDatasetPermissionsGateway(
      recorder(() => statusResponse(500)).request,
    );
    expect("readGroupDatasetGrants" in gateway).toBe(false);
  });

  it("forwards the principal-checked refresh policy to reads only when given", async () => {
    const withPrincipal = recorder(() =>
      jsonResponse(currentAdminAccountPayload),
    );
    await createDatasetPermissionsGateway(withPrincipal.request, {
      expectedPrincipalId: "principal-1",
    }).readGlobalPermissions();
    expect(withPrincipal.calls[0].policy).toEqual({
      retryOn401: true,
      expectedPrincipalId: "principal-1",
    });

    const without = recorder(() => jsonResponse(currentAdminAccountPayload));
    await createDatasetPermissionsGateway(
      without.request,
    ).readGlobalPermissions();
    expect(without.calls[0].policy).toBeUndefined();
  });
});

describe("mutations", () => {
  it("sends one encoded request per action and never retries on 401", async () => {
    const { calls, request } = recorder(() => statusResponse(200));
    const gateway = createDatasetPermissionsGateway(request, {
      expectedPrincipalId: "principal-1",
    });

    await gateway.assignRole(OPERATION);

    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].path).toBe(
      `/principal/context-grants/group/${RESEARCH_GROUP_ID}` +
        `/dataset/${DATASET_ID}/role/dg_ds-browse`,
    );
    // A mutation never inherits the read policy, whatever the caller supplied.
    expect(calls[0].policy).toEqual({ retryOn401: false });
  });

  it("encodes every path segment", async () => {
    const { calls, request } = recorder(() => statusResponse(200));
    await createDatasetPermissionsGateway(request).removeRole({
      ...OPERATION,
      groupId: "group/../admin",
      role: "dg_ds-browse?x=1",
    });

    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].path).toBe(
      `/principal/context-grants/group/group%2F..%2Fadmin` +
        `/dataset/${DATASET_ID}/role/dg_ds-browse%3Fx%3D1`,
    );
  });

  it("acknowledges only a completed-success status", async () => {
    // The controller declares exactly one success for both actions
    // (`SwaggerResponse(statusCode: 200)`); 204 is the conventional empty-body
    // completion for its `Task` return.
    for (const status of [200, 204]) {
      for (const action of ["assignRole", "removeRole"] as const) {
        const { request } = recorder(() => statusResponse(status));
        await expect(
          createDatasetPermissionsGateway(request)[action](OPERATION),
        ).resolves.toEqual({ kind: "acknowledged", httpStatus: status });
      }
    }
  });

  // PM-C1 R4. Acceptance for processing is not completion: showing a 202 as
  // Applied asserts a grant the Gateway only promised to consider, and clears
  // the journal entry that is the only record the write ever went out. No 202
  // has been observed on this route — this refuses to guess, it does not
  // infer an asynchronous contract.
  it.each([202, 201, 203, 205, 206, 299])(
    "keeps a %i response uncertain rather than applied",
    async (status) => {
      for (const action of ["assignRole", "removeRole"] as const) {
        const { request } = recorder(() => statusResponse(status));
        await expect(
          createDatasetPermissionsGateway(request)[action](OPERATION),
        ).resolves.toEqual({
          kind: "uncertain",
          reason: "inconclusive-status",
          httpStatus: status,
        });
      }
    },
  );

  it("refuses only where the pinned source proves no side effect ran", async () => {
    // 400 (model binding and the validation filter), 401 (the Authorize
    // attribute) and 403 (the single AuthorizeOrAffiliatedContextForce call,
    // which sits ahead of the AAI write) all resolve before anything is
    // written. See the trace in `gateway.ts`.
    for (const status of [400, 401, 403]) {
      const { request } = recorder(() => statusResponse(status));
      await expect(
        createDatasetPermissionsGateway(request).assignRole(OPERATION),
      ).resolves.toEqual({ kind: "refused", httpStatus: status });
    }
  });

  it("keeps every other status uncertain, 424 and 404 included", async () => {
    // 424 is DGUnderpinningException, which can be thrown before the AAI write
    // or by it. 404 has no source at this revision, so nothing about it is
    // provable. 500 can arrive after a partial Keycloak write.
    for (const status of [404, 409, 424, 500, 503]) {
      const { request } = recorder(() => statusResponse(status));
      await expect(
        createDatasetPermissionsGateway(request).removeRole(OPERATION),
      ).resolves.toEqual({
        kind: "uncertain",
        reason: "inconclusive-status",
        httpStatus: status,
      });
    }
  });

  it("does not copy onboarding's classifier: a 403 here is a real refusal", async () => {
    // Onboarding's start path keeps 403 unknown because it has two
    // authorization throws with a persist between them. This path has one,
    // ahead of every side effect, and classifying it as unknown here would
    // leave a refused manager permanently blocked from their own inverse.
    const { request } = recorder(() => statusResponse(403));
    const outcome =
      await createDatasetPermissionsGateway(request).assignRole(OPERATION);
    expect(outcome.kind).toBe("refused");
  });

  it("treats a lost response and a local abort as uncertain, not as failure", async () => {
    const lost = recorder(() => {
      throw new TypeError("network down");
    });
    await expect(
      createDatasetPermissionsGateway(lost.request).assignRole(OPERATION),
    ).resolves.toEqual({ kind: "uncertain", reason: "no-response" });

    const aborted = recorder(() => {
      throw new DOMException("aborted", "AbortError");
    });
    // An abort is a local decision. The request may already have been applied.
    await expect(
      createDatasetPermissionsGateway(aborted.request).assignRole(OPERATION),
    ).resolves.toEqual({ kind: "uncertain", reason: "aborted" });
  });

  it("performs no second call of any kind after an uncertain outcome", async () => {
    const { calls, request } = recorder(() => statusResponse(500));
    await createDatasetPermissionsGateway(request).assignRole(OPERATION);

    // No retry, no compensating delete, no reconciliation read.
    expect(calls).toHaveLength(1);
  });
});
