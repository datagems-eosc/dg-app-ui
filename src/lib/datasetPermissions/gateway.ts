/**
 * Dataset permissions — Gateway adapter.
 *
 * Transport is *injected*, so this module has no dependency on `useApi`, auth
 * or the network and can be exercised without either. The injected request has
 * the same signature as the existing private `makeRequest` in
 * `src/hooks/useApi.ts` — `(path, RequestInit, AuthRetryPolicy?) => Response` —
 * which already applies the bearer token and the `/gw/api` prefix. Paths here
 * are relative to `/gw/api` and must not repeat it. Building the real binding
 * is task 3.2; nothing here instantiates or modifies it.
 *
 * Each operation performs exactly **one** transport call. There is no retry, no
 * polling, no cache and no compensation anywhere in this file, and no operation
 * interprets an HTTP success as publication, as recipient access, or as
 * evidence about any principal other than the one the call was about.
 *
 * Endpoint provenance, all read from the local dg-app-api clone at
 * `8988a7e879a2239b85dcb4a7f4ce932e368674fd` and **not** observed live:
 *
 *  - `GET /principal/me?f=permissions` — `PrincipalController.Me`,
 *    `AccountBuilder.Build`. Returns the principal's global permission names.
 *  - `GET /dataset/{id}?f=permissions.<name>…` — `DatasetBuilder.Build` with
 *    `Extensions.ReduceToAssignedPermissions`: the requested names reduced
 *    against the caller's effective context roles for that exact dataset.
 *  - `POST /user/group/query` — `UserController.Query`, `UserGroupBuilder`.
 *  - `GET /principal/group/{groupId}/context-grants/dataset?id=…` —
 *    `PrincipalController.ContextGrantsDatasetGroupOther`, gated on the global
 *    `LookupContextGrantOther` permission.
 *  - `POST`/`DELETE /principal/context-grants/group/{groupId}/dataset/{datasetId}/role/{role}`
 *    — `PrincipalController.AddUserGroupToDatasetContextGrant` and
 *    `RemoveUserGroupFromDatasetContextGrant`.
 *
 * No endpoint is invented here. In particular there is no call that reads
 * "every group holding a role on this dataset": the Gateway has no such route,
 * and recipient knowledge is available only one group at a time and only to a
 * caller holding the global lookup permission.
 */

import type { AuthRetryPolicy } from "@/lib/utils";
import { decodeCallerPermissions } from "./decode";
import {
  decodeGroupDatasetGrants,
  decodeUserGroups,
  GROUP_PROJECTION,
} from "./groups";
import {
  datasetPermissionEvidence,
  exhaustivePermissionsRead,
  PERMISSIONS_FAILED,
} from "./model";
import {
  ACCESS_ACTION_NAMES,
  type DatasetRoleOperation,
  type DatasetRoleOutcome,
  type DecodedCallerPermissions,
  type GroupDiscoveryState,
  type PermissionSetEvidence,
  type RecipientGrantsState,
} from "./types";

/** Same shape as the existing authenticated transport in `useApi`. */
export type DatasetPermissionsTransport = (
  path: string,
  init: RequestInit,
  policy?: AuthRetryPolicy,
) => Promise<Response>;

/** Why a read did not produce evidence. Diagnosis only; nothing branches on it. */
export type PermissionsReadFailure =
  | { readonly kind: "unauthorized"; readonly httpStatus: 401 }
  | { readonly kind: "forbidden"; readonly httpStatus: 403 }
  | { readonly kind: "transient"; readonly httpStatus?: number }
  | { readonly kind: "malformed"; readonly httpStatus: number }
  | { readonly kind: "cancelled" };

export interface PermissionsReadResult {
  readonly evidence: PermissionSetEvidence;
  /** Present only when the read did not complete. */
  readonly failure?: PermissionsReadFailure;
}

export interface GroupsReadResult {
  readonly state: GroupDiscoveryState;
  readonly failure?: PermissionsReadFailure;
  /** Groups the response carried but that could not be used. See `groups.ts`. */
  readonly dropped?: number;
}

export interface RecipientReadResult {
  readonly state: RecipientGrantsState;
  readonly failure?: PermissionsReadFailure;
}

export interface DatasetPermissionsGateway {
  /** The principal's own global permission names. Exhaustive within its scope. */
  readGlobalPermissions(signal?: AbortSignal): Promise<PermissionsReadResult>;
  /**
   * The grant and revoke permission names projected for this exact dataset.
   * The projected name set travels with the result, which is what keeps an
   * unrequested name `unknown` rather than denied.
   */
  readDatasetActionPermissions(
    datasetId: string,
    signal?: AbortSignal,
  ): Promise<PermissionsReadResult>;
  /** Groups visible to this caller, projected with their semantics. */
  queryGroups(signal?: AbortSignal): Promise<GroupsReadResult>;
  /** One group's roles on one dataset. Gated; a refusal stays unavailable. */
  readGroupDatasetGrants(
    groupId: string,
    datasetId: string,
    signal?: AbortSignal,
  ): Promise<RecipientReadResult>;
  /** One explicit role assignment. Dispatched once, never retried here. */
  assignRole(
    operation: DatasetRoleOperation,
    signal?: AbortSignal,
  ): Promise<DatasetRoleOutcome>;
  /** One explicit role removal. Dispatched once, never retried here. */
  removeRole(
    operation: DatasetRoleOperation,
    signal?: AbortSignal,
  ): Promise<DatasetRoleOutcome>;
}

/**
 * The action names the dataset projection asks for.
 *
 * `DatasetBuilder` reduces requested sub-field names against assigned
 * permissions case-insensitively, so the casing here is cosmetic — but the
 * *spelling* is not, as PM-01 found with `downloadDataset`. These come from
 * `ACCESS_ACTION_NAMES`, which comes from `Authorization/Permission.cs`.
 *
 * `lookupRecipients` is deliberately absent: it is a global permission checked
 * by `AuthorizeForce`, not by affiliated context, so projecting it per dataset
 * would ask a question the endpoint cannot answer.
 */
export const DATASET_ACTION_PERMISSION_NAMES: readonly string[] = [
  ACCESS_ACTION_NAMES.grant,
  ACCESS_ACTION_NAMES.revoke,
];

/**
 * The statuses that mean this mutation completed.
 *
 * Deliberately a list and not a 2xx range: only these two say the assignment
 * was made. See `classifyMutation` for the source trace.
 */
export const COMPLETED_MUTATION_STATUSES: readonly number[] = [200, 204];

const lowerFirst = (value: string): string =>
  value.length === 0 ? value : value[0].toLowerCase() + value.slice(1);

export const buildFieldQuery = (fields: readonly string[]): string =>
  fields.length === 0
    ? ""
    : `?${fields.map((field) => `f=${encodeURIComponent(field)}`).join("&")}`;

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

const classifyReadFailure = (httpStatus: number): PermissionsReadFailure => {
  if (httpStatus === 401) return { kind: "unauthorized", httpStatus: 401 };
  if (httpStatus === 403) return { kind: "forbidden", httpStatus: 403 };
  return { kind: "transient", httpStatus };
};

const parseJson = async (
  response: Response,
): Promise<{ ok: true; body: unknown } | { ok: false }> => {
  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false };
  }
};

export interface DatasetPermissionsGatewayOptions {
  /**
   * Forwarded to the transport's 401 policy on **reads only**, so a refreshed
   * session is used again only when it still belongs to this principal. Omit it
   * and reads keep the transport's existing default behaviour. Mutations ignore
   * it: they always travel with `retryOn401: false`.
   */
  readonly expectedPrincipalId?: string;
  /**
   * Where the group query lives. The existing `useApi` helper resolves this
   * from `USER_GROUPS_ENDPOINT`, so the deployment already treats it as
   * configurable; this option exists so a caller can pass the same resolved
   * value rather than letting a second hardcoded default drift away from it.
   */
  readonly groupQueryPath?: string;
}

export const DEFAULT_GROUP_QUERY_PATH = "/user/group/query";

export const createDatasetPermissionsGateway = (
  request: DatasetPermissionsTransport,
  options: DatasetPermissionsGatewayOptions = {},
): DatasetPermissionsGateway => {
  const readPolicy: AuthRetryPolicy | undefined =
    options.expectedPrincipalId === undefined
      ? undefined
      : { retryOn401: true, expectedPrincipalId: options.expectedPrincipalId };

  /** No automatic replay of a mutation, ever. This is the whole policy. */
  const mutationPolicy: AuthRetryPolicy = { retryOn401: false };

  const readJson = async (
    path: string,
    signal: AbortSignal | undefined,
  ): Promise<
    | { readonly ok: true; readonly body: unknown; readonly httpStatus: number }
    | { readonly ok: false; readonly failure: PermissionsReadFailure }
  > => {
    let response: Response;
    try {
      response = await request(
        path,
        { method: "GET", ...(signal ? { signal } : {}) },
        readPolicy,
      );
    } catch (error) {
      if (isAbortError(error)) {
        return { ok: false, failure: { kind: "cancelled" } };
      }
      return { ok: false, failure: { kind: "transient" } };
    }

    if (!response.ok) {
      return { ok: false, failure: classifyReadFailure(response.status) };
    }

    const parsed = await parseJson(response);
    if (!parsed.ok) {
      return {
        ok: false,
        failure: { kind: "malformed", httpStatus: response.status },
      };
    }
    return { ok: true, body: parsed.body, httpStatus: response.status };
  };

  /**
   * Classify one mutation's response.
   *
   * **The refusal boundary, traced at the pinned revision.** Both
   * `AddUserGroupToDatasetContextGrant` (`PrincipalController.cs:438-455`) and
   * `RemoveUserGroupFromDatasetContextGrant` (`:572-589`) run, in order:
   * `[Authorize]`, `[ModelStateValidationFilter]`, then an action body that
   * resolves the caller's effective context roles, calls
   * `AuthorizeOrAffiliatedContextForce(…, Permission.Add/RemoveUser…)`, and only
   * afterwards calls the AAI service and the accounting service.
   *
   *  - **401** comes from the `[Authorize]` attribute and the authentication
   *    middleware, before the action body. No `DGUnauthorizedException` is
   *    thrown anywhere on this path.
   *  - **400** comes from route model binding (`Guid datasetId`) and from
   *    `[ModelStateValidationFilter]`, both action filters that run before the
   *    body. No `DGValidationException` is thrown on this path either.
   *  - **403** has exactly one source here: the `DGForbiddenException` thrown by
   *    `AuthorizationService.Authorize` at `Api/Authorization/AuthorizationService.cs:121`
   *    when `force` is set. On this path that check sits *before* the AAI call,
   *    and the AAI service throws no forbidden exception of its own.
   *
   * This is the point where onboarding's classifier must **not** be copied. The
   * onboarding start path has two authorization throws with a persist between
   * them, which is why its 403 stays unknown. This path has one, ahead of every
   * side effect, so 403 here is a genuine refusal.
   *
   * **Success is only the statuses that mean the work is finished.** Both
   * actions return `Task`, and both declare exactly one success in their
   * attributes — `SwaggerResponse(statusCode: 200)`, "the user group was
   * added to / removed from the context grant group". 204 is kept alongside it
   * as the conventional empty-body completion for a void action. Every other
   * 2xx is uncertain, 202 included: acceptance for processing is not
   * completion, and showing it as Applied would assert a grant the Gateway
   * only promised to consider. No 202 has been observed on this route and no
   * asynchronous contract is inferred from allowing for one — this is a
   * refusal to guess, not a claim about deployed behaviour.
   *
   * Everything else is uncertain, including:
   *
   *  - **424** (`DGUnderpinningException`, which `ErrorHandlingMiddleware` maps
   *    to Failed Dependency, not 503): it can come from the group lookup before
   *    any write *or* from a failing Keycloak call after one, and the response
   *    does not say which.
   *  - **500** and any 5xx: `AssignTargetGrantToUserGroup` writes through
   *    `EnsureHierarchyLevel` and `EnsureRole`, and `UnassignTargetGrantFrom…`
   *    also calls `EnsureHierarchyLevel` before removing a role — so even a
   *    failed *removal* may have created structure. A failure mid-sequence is
   *    not a rollback.
   *  - **404**: no code path at this revision produces one for this route, so
   *    nothing about it can be proven from source. An unproven status is not a
   *    refusal.
   *
   * AAI writes go to Keycloak, outside the `AppTransactionFilter` database
   * transaction, so no ambient rollback covers them. Nothing in this mapping is
   * a live observation; PM-05 and the controlled smoke in 4.3 still own that.
   */
  const classifyMutation = (httpStatus: number): DatasetRoleOutcome => {
    if (COMPLETED_MUTATION_STATUSES.includes(httpStatus)) {
      return { kind: "acknowledged", httpStatus };
    }
    if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403) {
      return { kind: "refused", httpStatus };
    }
    return { kind: "uncertain", reason: "inconclusive-status", httpStatus };
  };

  const mutate = async (
    operation: DatasetRoleOperation,
    method: "POST" | "DELETE",
    signal: AbortSignal | undefined,
  ): Promise<DatasetRoleOutcome> => {
    // Every segment is encoded: a group id or role identifier is opaque text,
    // and one containing a slash must not become a different route.
    const path =
      `/principal/context-grants/group/${encodeURIComponent(operation.groupId)}` +
      `/dataset/${encodeURIComponent(operation.datasetId)}` +
      `/role/${encodeURIComponent(operation.role)}`;

    let response: Response;
    try {
      response = await request(
        path,
        { method, ...(signal ? { signal } : {}) },
        mutationPolicy,
      );
    } catch (error) {
      // An abort is a *local* decision. The request may already have been
      // dispatched and applied, so it is uncertain, never "cancelled and safe".
      return {
        kind: "uncertain",
        reason: isAbortError(error) ? "aborted" : "no-response",
      };
    }

    return classifyMutation(response.status);
  };

  return {
    async readGlobalPermissions(signal) {
      const result = await readJson(
        `/principal/me${buildFieldQuery(["permissions"])}`,
        signal,
      );
      if (!result.ok) {
        return { evidence: PERMISSIONS_FAILED, failure: result.failure };
      }

      const body = result.body;
      const permissions =
        typeof body === "object" && body !== null && !Array.isArray(body)
          ? (body as Record<string, unknown>).permissions
          : undefined;

      const decoded: DecodedCallerPermissions =
        decodeCallerPermissions(permissions);
      if (decoded.kind !== "read") {
        return {
          evidence: PERMISSIONS_FAILED,
          failure: { kind: "malformed", httpStatus: result.httpStatus },
        };
      }

      // `Account.permissions` is the principal's whole global set, so absence
      // inside it is a real negative. `deferredPermissions` is never read here.
      return { evidence: exhaustivePermissionsRead(decoded.names) };
    },

    async readDatasetActionPermissions(datasetId, signal) {
      const fields = [
        "id",
        ...DATASET_ACTION_PERMISSION_NAMES.map(
          (name) => `permissions.${lowerFirst(name)}`,
        ),
      ];
      const result = await readJson(
        `/dataset/${encodeURIComponent(datasetId)}${buildFieldQuery(fields)}`,
        signal,
      );
      if (!result.ok) {
        return { evidence: PERMISSIONS_FAILED, failure: result.failure };
      }

      const body = result.body;
      const permissions =
        typeof body === "object" && body !== null && !Array.isArray(body)
          ? (body as Record<string, unknown>).permissions
          : undefined;

      // The requested name set travels with the evidence. A dataset the caller
      // holds no affiliated role on comes back with no `permissions` field at
      // all, which decodes to `absent` and therefore to `not-read`.
      return {
        evidence: datasetPermissionEvidence(
          decodeCallerPermissions(permissions),
          DATASET_ACTION_PERMISSION_NAMES,
        ),
      };
    },

    async queryGroups(signal) {
      let response: Response;
      try {
        response = await request(
          options.groupQueryPath ?? DEFAULT_GROUP_QUERY_PATH,
          {
            method: "POST",
            body: JSON.stringify({
              project: { fields: [...GROUP_PROJECTION] },
            }),
            ...(signal ? { signal } : {}),
          },
          readPolicy,
        );
      } catch (error) {
        return {
          state: { kind: "failed" },
          failure: isAbortError(error)
            ? { kind: "cancelled" }
            : { kind: "transient" },
        };
      }

      if (!response.ok) {
        return {
          state: { kind: "failed" },
          failure: classifyReadFailure(response.status),
        };
      }

      const parsed = await parseJson(response);
      if (!parsed.ok) {
        return {
          state: { kind: "failed" },
          failure: { kind: "malformed", httpStatus: response.status },
        };
      }

      const decoded = decodeUserGroups(parsed.body);
      if (!decoded.ok) {
        return {
          state: { kind: "failed" },
          failure: { kind: "malformed", httpStatus: response.status },
        };
      }

      return {
        state: { kind: "read", groups: decoded.value.groups },
        dropped: decoded.value.dropped,
      };
    },

    async readGroupDatasetGrants(groupId, datasetId, signal) {
      const result = await readJson(
        `/principal/group/${encodeURIComponent(groupId)}/context-grants/dataset` +
          `?id=${encodeURIComponent(datasetId)}`,
        signal,
      );

      if (!result.ok) {
        // A 403 here is the *ordinary manager* case, not a broken read: the
        // endpoint requires the global `LookupContextGrantOther` permission.
        // It must stay "unknown, not supported", so no view can draw it as an
        // empty recipient list.
        if (result.failure.kind === "forbidden") {
          return {
            state: { kind: "unknown", reason: "not-supported" },
            failure: result.failure,
          };
        }
        return { state: { kind: "failed" }, failure: result.failure };
      }

      const decoded = decodeGroupDatasetGrants(result.body, {
        groupId,
        datasetId,
      });
      if (!decoded.ok) {
        return {
          state: { kind: "failed" },
          failure: { kind: "malformed", httpStatus: result.httpStatus },
        };
      }

      return { state: { kind: "known", grants: decoded.value } };
    },

    assignRole(operation, signal) {
      return mutate(operation, "POST", signal);
    },

    removeRole(operation, signal) {
      return mutate(operation, "DELETE", signal);
    },
  };
};
