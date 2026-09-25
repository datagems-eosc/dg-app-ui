/**
 * Dataset onboarding — scoped read-only dataset availability.
 *
 * One question, answered honestly: can *this* session read *this* dataset's
 * metadata right now? That is the only evidence task 5.3 needs before offering
 * a dataset action, and it is deliberately the only thing this module can say.
 *
 * Why not the existing `useApi.getDatasetById`: it throws a generic Error, so
 * 403, 404 and a network fault all arrive as the same thing, and it runs the
 * transport's default 401 refresh/retry policy. Availability evidence has to
 * distinguish "refused" from "not found" from "we could not tell", and the
 * feature's reads are already bound to a principal-checked retry policy. Reusing
 * it and calling the result scoped would be a claim we cannot support.
 *
 * Transport is injected, exactly as in `gateway.ts`, so this module has no
 * dependency on React, auth or `useApi`, and each operation performs exactly
 * one request.
 *
 * Contract source: dg-app-api `8988a7e879a2239b85dcb4a7f4ce932e368674fd`,
 * `Controllers/DatasetController.cs` `Get` (lines 119-145) returns **one**
 * `App.Model.Dataset` after censor and builder processing — the Swagger
 * annotation naming `QueryResult` is misleading, the C# return type is not
 * wrapped — and `Model/Builder/DatasetBuilder.cs` projects `Id` and `Name` from
 * the requested field set. Source-derived; no live capture has been made.
 *
 * What a readable outcome does **not** establish: that any details subresource,
 * download, search, sharing, grant or DMM-ready state is available. Metadata
 * readability is the whole claim.
 */

import { buildFieldQuery, type OnboardingTransport } from "./gateway";
import { asDatasetId, type DatasetId } from "./types";

/** `id` proves identity; `name` is optional and used only as a subtitle. */
export const DATASET_ACCESS_PROJECTION = ["id", "name"] as const;

/**
 * Outcomes are separate cases rather than a boolean plus an error, because the
 * caller must treat "refused" and "could not tell" differently: one is a stable
 * answer, the other is worth another look.
 */
export type DatasetAccessOutcome =
  /** A single object whose `id` is the dataset we asked about. */
  | {
      readonly kind: "readable";
      readonly datasetId: DatasetId;
      readonly name?: string;
    }
  /** 403. A stable refusal for this session; do not keep asking. */
  | { readonly kind: "denied"; readonly httpStatus: number }
  /** 401. Says something about the session, nothing about the dataset. */
  | { readonly kind: "auth-unusable"; readonly httpStatus: number }
  /** 404. The reference did not resolve. This is not deletion. */
  | { readonly kind: "unavailable"; readonly httpStatus: number }
  /** Network fault, unexpected status, unreadable body, or an id that is not ours. */
  | {
      readonly kind: "unknown";
      readonly reason: "transient" | "malformed" | "identity-mismatch";
      readonly httpStatus?: number;
    }
  /** The caller aborted. Never evidence of anything. */
  | { readonly kind: "cancelled" };

export interface DatasetAccessReader {
  readDataset(
    datasetId: DatasetId,
    signal?: AbortSignal,
  ): Promise<DatasetAccessOutcome>;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A name is decoration. It is accepted only as a plain, non-empty string with
 * no control characters — anything else is dropped rather than rendered, and
 * dropping it never affects the availability answer.
 */
const readableName = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  for (let index = 0; index < trimmed.length; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return undefined;
  }
  return trimmed;
};

export const createDatasetAccessReader = (
  request: OnboardingTransport,
): DatasetAccessReader => ({
  async readDataset(datasetId, signal) {
    const path = `/dataset/${encodeURIComponent(datasetId)}${buildFieldQuery(
      DATASET_ACCESS_PROJECTION,
    )}`;

    let response: Response;
    try {
      response = await request(path, {
        method: "GET",
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (isAbortError(error)) return { kind: "cancelled" };
      // Includes the transport refusing outright when no identity is resolved.
      return { kind: "unknown", reason: "transient" };
    }

    if (!response.ok) {
      const httpStatus = response.status;
      if (httpStatus === 401) return { kind: "auth-unusable", httpStatus };
      if (httpStatus === 403) return { kind: "denied", httpStatus };
      if (httpStatus === 404) return { kind: "unavailable", httpStatus };
      // 400 lands here too: the route binds a Guid, so a reference this client
      // considers usable can still be rejected as unbindable. That is a reason
      // to stop guessing, never a reason to claim the dataset is readable.
      return { kind: "unknown", reason: "transient", httpStatus };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      // An abort during body decoding is a cancellation, not a malformed read.
      if (isAbortError(error)) return { kind: "cancelled" };
      return {
        kind: "unknown",
        reason: "malformed",
        httpStatus: response.status,
      };
    }

    // A wrapper or an array is not the documented single-object shape, and
    // unwrapping one would be guessing at a contract we have not observed.
    if (!isRecord(body)) {
      return {
        kind: "unknown",
        reason: "malformed",
        httpStatus: response.status,
      };
    }

    const rawId = body.id;
    if (typeof rawId !== "string" || rawId.trim() === "") {
      return {
        kind: "unknown",
        reason: "malformed",
        httpStatus: response.status,
      };
    }

    // Exact identity, not a near match. If a deployment ever changed id
    // formatting this under-confirms availability, which is the safe
    // direction: the action is withheld rather than offered for the wrong
    // dataset.
    if (rawId.trim() !== String(datasetId).trim()) {
      return {
        kind: "unknown",
        reason: "identity-mismatch",
        httpStatus: response.status,
      };
    }

    const name = readableName(body.name);
    return {
      kind: "readable",
      datasetId: asDatasetId(rawId.trim()),
      ...(name === undefined ? {} : { name }),
    };
  },
});
