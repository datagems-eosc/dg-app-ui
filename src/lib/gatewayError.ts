/**
 * User-facing classification of failed Gateway requests.
 *
 * The Gateway reports every partner-service failure as HTTP 424, code 104
 * "error communicating with underpinning service", with the upstream service
 * (`message.source`), its HTTP status (`message.statusCode`, null when it was
 * unreachable), a `correlationId`, and — only when the upstream answered 400 —
 * the upstream body in `message.payload`. That `error` text means nothing to a
 * user, so it is never shown: the failure is classified and the message is the
 * copy for its kind, plus a short reference for support.
 */

import { ApiErrorMessage } from "./apiErrors";
import { logApiError } from "./logger";

export enum GatewayErrorKind {
  Unanswerable = "unanswerable",
  Unavailable = "unavailable",
  Generic = "generic",
}

/**
 * What support needs to trace a failure, and all that is logged. Deliberately
 * no payload or response text: those can echo the user's question.
 */
export interface GatewayErrorDetails {
  readonly kind: GatewayErrorKind;
  readonly status: number | null;
  readonly code: number | null;
  readonly source: string | null;
  readonly upstreamStatus: number | null;
  readonly correlationId: string | null;
}

export class GatewayError extends Error {
  readonly details: GatewayErrorDetails;

  constructor(
    message: string,
    details: GatewayErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GatewayError";
    this.details = details;
  }

  get kind(): GatewayErrorKind {
    return this.details.kind;
  }

  get correlationId(): string | null {
    return this.details.correlationId;
  }
}

const NO_RESPONSE: GatewayErrorDetails = {
  kind: GatewayErrorKind.Unavailable,
  status: null,
  code: null,
  source: null,
  upstreamStatus: null,
  correlationId: null,
};

const IN_DATA_EXPLORATION = "InDataExploration";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

/**
 * The upstream validation body, as in-dataset discovery returns it for an
 * unanswerable question: `{ code: 102, message: [{ Key, Value: string[] }] }`.
 * The Gateway forwards it as a JSON string. Only the `Value` texts are read;
 * the body's own `error` ("validation error") is not user copy.
 */
const readServiceMessage = (payload: unknown): string | null => {
  let body: unknown = payload;
  if (typeof payload === "string") {
    try {
      body = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  const entries = asRecord(body)?.message;
  if (!Array.isArray(entries)) return null;
  const texts = entries.flatMap((entry) => {
    const values = asRecord(entry)?.Value;
    return Array.isArray(values)
      ? values.map(asString).filter((text): text is string => text !== null)
      : [];
  });
  return texts.length > 0 ? texts.join(" ").trim() : null;
};

const COPY: Record<GatewayErrorKind, ApiErrorMessage> = {
  [GatewayErrorKind.Unanswerable]: ApiErrorMessage.GATEWAY_UNANSWERABLE,
  [GatewayErrorKind.Unavailable]: ApiErrorMessage.GATEWAY_UNAVAILABLE,
  [GatewayErrorKind.Generic]: ApiErrorMessage.GATEWAY_GENERIC,
};

/** First matching rule wins (spec: gateway-error-messages). */
const classify = (
  status: number,
  source: string | null,
  upstreamStatus: number | null,
): GatewayErrorKind => {
  if (
    source === IN_DATA_EXPLORATION &&
    (upstreamStatus === 400 || upstreamStatus === 422)
  ) {
    return GatewayErrorKind.Unanswerable;
  }
  if (
    (upstreamStatus !== null && upstreamStatus >= 500) ||
    (status === 424 && upstreamStatus === null) ||
    status >= 500
  ) {
    return GatewayErrorKind.Unavailable;
  }
  return GatewayErrorKind.Generic;
};

export const withReference = (
  text: string,
  correlationId: string | null,
): string =>
  correlationId ? `${text} Reference: ${correlationId.slice(0, 8)}` : text;

/**
 * The text a classified Gateway failure may show the user (its copy and
 * reference); `undefined` for any other error, whose own text is never shown.
 */
export const gatewayMessage = (err: unknown): string | undefined =>
  err instanceof GatewayError ? err.message : undefined;

export function gatewayErrorFromResponse(
  status: number,
  body: unknown,
): GatewayError {
  const record = asRecord(body);
  const detail = asRecord(record?.message);
  const source = asString(detail?.source);
  const upstreamStatus = asNumber(detail?.statusCode);
  const correlationId = asString(detail?.correlationId);

  const kind = classify(status, source, upstreamStatus);
  let text: string = COPY[kind];
  if (kind === GatewayErrorKind.Unanswerable) {
    text = readServiceMessage(detail?.payload) ?? text;
  }

  return new GatewayError(withReference(text, correlationId), {
    kind,
    status,
    code: asNumber(record?.code),
    source,
    upstreamStatus,
    correlationId,
  });
}

/**
 * Builds the error for a request that got no response (network failure or
 * timeout). The cause is kept on the error; its text is never shown.
 */
export const gatewayErrorFromNetworkFailure = (cause: unknown): GatewayError =>
  new GatewayError(COPY[GatewayErrorKind.Unavailable], NO_RESPONSE, { cause });

/**
 * True for the error kinds `fetch` rejects with when no response arrives: a
 * `TypeError` on a network failure and a `TimeoutError` on a signal timeout.
 * A local `AbortError` is a cancellation, not a failure. Any code can throw a
 * `TypeError`, so pair this with `isFetchRejection` to know `fetch` threw it.
 */
export const isNetworkFailure = (
  error: unknown,
): error is TypeError | DOMException =>
  error instanceof TypeError ||
  (error instanceof DOMException && error.name === "TimeoutError");

/** Tolerates a missing or non-JSON body. */
export async function readGatewayError(
  response: Response,
): Promise<GatewayError> {
  const body: unknown = await response.json().catch(() => undefined);
  return gatewayErrorFromResponse(response.status, body);
}

/**
 * Logs a classified failure and returns it for throwing. The logged error is a
 * fixed label, not `error.message`: the shown text can be the service's own
 * message, which can quote the user's question.
 */
export const reportGatewayError = (
  operation: string,
  error: GatewayError,
  context?: Record<string, unknown>,
): GatewayError => {
  logApiError(operation, `Gateway request failed (${error.kind})`, {
    ...error.details,
    ...context,
  });
  return error;
};
