import { describe, expect, it, vi } from "vitest";
import {
  currentAdminAccountPayload,
  currentAdminGroupGrantsPayload,
  currentGroupQueryPayload,
  currentManagerAccountPayload,
  DATASET_ID,
  datasetActionsAbsentPayload,
  datasetActionsDeniedPayload,
  datasetActionsGrantedPayload,
  deniedManagerRecipientReadStatus,
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
        "&f=permissions.removeUserFromContextGrantGroup",
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
        ],
      },
    });
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

  it("reports a malformed recipient role array as failed, never as known", async () => {
    // PM-C1 R3 at the adapter boundary: a present array carrying an unusable
    // member must not reach the view as complete recipient knowledge, which it
    // would draw as "this group holds none of these roles".
    for (const roles of [[null], ["dg_ds-browse", 17], [""]]) {
      const { request } = recorder(() => jsonResponse({ [DATASET_ID]: roles }));
      const result = await createDatasetPermissionsGateway(
        request,
      ).readGroupDatasetGrants(RESEARCH_GROUP_ID, DATASET_ID);

      expect(result.state).toEqual({ kind: "failed" });
      expect(result.failure).toMatchObject({ kind: "malformed" });
    }
  });

  it("keeps a valid empty recipient array as known, not failed", async () => {
    const { request } = recorder(() => jsonResponse({ [DATASET_ID]: [] }));
    const result = await createDatasetPermissionsGateway(
      request,
    ).readGroupDatasetGrants(RESEARCH_GROUP_ID, DATASET_ID);

    expect(result.state).toEqual({ kind: "known", grants: [] });
  });

  it("keeps a refused recipient read unsupported rather than empty", async () => {
    const { request } = recorder(() =>
      statusResponse(deniedManagerRecipientReadStatus),
    );
    const result = await createDatasetPermissionsGateway(
      request,
    ).readGroupDatasetGrants(RESEARCH_GROUP_ID, DATASET_ID);

    // This is the ordinary-manager case. "Not supported" is the whole point:
    // an empty grant list here would read as "nobody has access".
    expect(result.state).toEqual({ kind: "unknown", reason: "not-supported" });
    expect(result.failure).toEqual({ kind: "forbidden", httpStatus: 403 });
  });

  it("reads one group's roles on one dataset when it is permitted", async () => {
    const { calls, request } = recorder(() =>
      jsonResponse(currentAdminGroupGrantsPayload),
    );
    const result = await createDatasetPermissionsGateway(
      request,
    ).readGroupDatasetGrants(RESEARCH_GROUP_ID, DATASET_ID);

    expect(calls[0].path).toBe(
      `/principal/group/${RESEARCH_GROUP_ID}/context-grants/dataset?id=${DATASET_ID}`,
    );
    expect(result.state).toEqual({
      kind: "known",
      grants: [
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-browse" },
        { groupId: RESEARCH_GROUP_ID, role: "dg_ds-download" },
      ],
    });
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
