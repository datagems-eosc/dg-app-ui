/**
 * Dataset onboarding — Gateway adapter.
 *
 * Transport is *injected*, so this module has no dependency on `useApi`, auth
 * or React and can be exercised without a network. The injected request has the
 * same signature as the existing private `makeRequest` in `src/hooks/useApi.ts`
 * — `(path, RequestInit) => Promise<Response>` — which already applies the
 * bearer token and the `/gw/api` prefix. Paths here are therefore relative to
 * `/gw/api` and must not repeat it.
 *
 * Deliberately absent: timers, retries, caching, grant policy. Each operation
 * performs exactly one transport call. Nothing here interprets an HTTP success
 * as publication or access.
 */

import {
  decodeConfig,
  decodeProcessSnapshot,
  decodeStartResponse,
} from "./decode";
import type {
  GatewayFailure,
  OnboardingConfig,
  OnboardingStartInput,
  ProcessInstanceId,
  ProcessSnapshot,
  ReadResult,
  StartOutcome,
} from "./types";

/** Same shape as the existing authenticated transport in `useApi`. */
export type OnboardingTransport = (
  path: string,
  init: RequestInit,
) => Promise<Response>;

export interface OnboardingGateway {
  start(
    input: OnboardingStartInput,
    signal?: AbortSignal,
  ): Promise<StartOutcome>;
  getConfig(signal?: AbortSignal): Promise<ReadResult<OnboardingConfig>>;
  getProcess(
    processInstanceId: ProcessInstanceId,
    signal?: AbortSignal,
  ): Promise<ReadResult<ProcessSnapshot>>;
}

/**
 * Routine polling projection. camelCase, one `f=` parameter per field — the
 * convention used by every working call in `useApi` and by the Gateway's own
 * OpenAPI example. `id` and `status` are always requested alongside the nested
 * projections so that a step-level denial degrades into a partial snapshot
 * instead of censoring the whole field set into a 403.
 *
 * `workflowTaskInstanceDetails` is deliberately excluded: it accumulates
 * appended operational text server-side and has no place in routine polling.
 */
export const PROCESS_PROJECTION = [
  "id",
  "processId",
  "status",
  "dataset.id",
  "steps.id",
  "steps.stepId",
  "steps.status",
] as const;

export const buildFieldQuery = (fields: readonly string[]): string =>
  fields.length === 0
    ? ""
    : `?${fields.map((field) => `f=${encodeURIComponent(field)}`).join("&")}`;

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

/** HTTP status → failure class. 404 does not assert deletion. */
const classifyHttp = (httpStatus: number): GatewayFailure => {
  if (httpStatus === 401) return { kind: "unauthorized", httpStatus };
  if (httpStatus === 403) return { kind: "forbidden", httpStatus };
  if (httpStatus === 404) return { kind: "unavailable-reference", httpStatus };
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

export const createOnboardingGateway = (
  request: OnboardingTransport,
): OnboardingGateway => {
  const read = async <T>(
    path: string,
    signal: AbortSignal | undefined,
    decode: (payload: unknown) => import("./types").DecodeResult<T>,
  ): Promise<ReadResult<T>> => {
    let response: Response;
    try {
      // GET carries no body: the field set travels in the query string.
      response = await request(path, {
        method: "GET",
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (isAbortError(error))
        return { ok: false, failure: { kind: "cancelled" } };
      return { ok: false, failure: { kind: "transient" } };
    }

    if (!response.ok) {
      return { ok: false, failure: classifyHttp(response.status) };
    }

    const parsed = await parseJson(response);
    if (!parsed.ok) {
      return {
        ok: false,
        failure: { kind: "malformed", httpStatus: response.status },
      };
    }

    const decoded = decode(parsed.body);
    if (!decoded.ok) {
      return {
        ok: false,
        failure: {
          kind: "malformed",
          httpStatus: response.status,
          failure: decoded.failure,
        },
      };
    }
    return { ok: true, value: decoded.value };
  };

  return {
    /**
     * `POST /workflow-process/onboard?f=id`.
     *
     * Rejection is claimed only for **400 and 401**, because the design
     * criterion is a guarantee — only a response that guarantees no accepted
     * start may be a definite rejection — not a list of codes. At the pinned
     * Gateway revision:
     *
     *  - 400 comes from `ModelStateValidationFilter` and the
     *    `[ValidationFilter(OnboardValidator)]` attribute, and 401 from the
     *    `[Authorize]` attribute and authentication middleware. All are action
     *    filters or middleware, so they run before the action body and before
     *    anything is persisted.
     *  - **403 is not equivalent.** The start path has *two* forbidden throws.
     *    The controller's censor check (`WorkflowProcessController.cs:258`) is
     *    pre-persistence, but `ExecuteOnboardingFlow` also runs
     *    `AuthorizeForce(CanExecuteDatasetOnboarding)` at `:198`, then
     *    `PersistFlow` at `:202`, and only then `ExecuteOnboarding`, whose
     *    first statement is `AuthorizeForce(OnboardDataset)` at `:397` —
     *    *after* the process and step rows exist. Those two permissions carry
     *    different roles in the checked-in defaults (curator satisfies the
     *    first but not the second), so a 403 can be returned for an attempt
     *    that did create a process. Whether the ambient `AppTransactionFilter`
     *    rolls that back cannot be settled from the pinned sources: the
     *    package is external and not vendored. No guarantee therefore exists,
     *    and 403 stays `unknown` with its `forbidden` detail preserved.
     *
     * Every other outcome — 404/5xx, an unreadable body, a 2xx without `id` —
     * is likewise `unknown`. An unknown start is never retried here and its
     * staging references must not be reused; that decision belongs to the
     * submission controller and requires a backend guarantee we do not have.
     * This mapping is source-derived and still needs the live check (L2/G1).
     */
    async start(input, signal) {
      const body = {
        name: input.name,
        description: input.description,
        license: input.license,
        headline: input.headline,
        keywords: [...input.keywords],
        fieldOfScience: [...input.fieldOfScience],
        datePublished: input.datePublished,
        dataLocations: input.dataLocations.map((location) => ({
          kind: location.kind,
          location: location.location,
        })),
        ...(input.language ? { language: [...input.language] } : {}),
        ...(input.country ? { country: [...input.country] } : {}),
        ...(input.url === undefined ? {} : { url: input.url }),
        ...(input.citeAs === undefined ? {} : { citeAs: input.citeAs }),
        ...(input.doi === undefined ? {} : { doi: input.doi }),
      };

      let response: Response;
      try {
        response = await request(
          `/workflow-process/onboard${buildFieldQuery(["id"])}`,
          {
            method: "POST",
            body: JSON.stringify(body),
            ...(signal ? { signal } : {}),
          },
        );
      } catch (error) {
        if (isAbortError(error)) {
          // The request was aborted locally; the server may still have accepted
          // it, so the outcome is unknown rather than cancelled-and-safe.
          return { kind: "unknown", failure: { kind: "cancelled" } };
        }
        return { kind: "unknown", failure: { kind: "transient" } };
      }

      if (!response.ok) {
        const httpStatus = response.status;
        if (httpStatus === 400 || httpStatus === 401) {
          return { kind: "rejected", httpStatus };
        }
        // 403 falls through here deliberately: `classifyHttp` preserves the
        // `forbidden` detail so the caller can explain the refusal, while the
        // outcome stays unknown so nothing is retried or reused.
        return { kind: "unknown", failure: classifyHttp(httpStatus) };
      }

      const parsed = await parseJson(response);
      if (!parsed.ok) {
        return {
          kind: "unknown",
          failure: { kind: "malformed", httpStatus: response.status },
        };
      }

      const decoded = decodeStartResponse(parsed.body);
      if (!decoded.ok) {
        return {
          kind: "unknown",
          failure: {
            kind: "malformed",
            httpStatus: response.status,
            failure: decoded.failure,
          },
        };
      }
      return { kind: "accepted", processInstanceId: decoded.value };
    },

    /** `GET /workflow-process/config`. No field set: the action takes none. */
    getConfig(signal) {
      return read("/workflow-process/config", signal, decodeConfig);
    },

    /** `GET /workflow-process/{id}` with the routine projection. */
    getProcess(processInstanceId, signal) {
      const path = `/workflow-process/${encodeURIComponent(
        processInstanceId,
      )}${buildFieldQuery(PROCESS_PROJECTION)}`;
      return read(path, signal, decodeProcessSnapshot);
    },
  };
};
