/**
 * Failure bodies as recorded from the Gateway, which wraps every upstream
 * failure as HTTP 424, code 104 "error communicating with underpinning
 * service" (its ErrorHandlingMiddleware) and copies the upstream body into
 * `message.payload` only when the upstream answered 400.
 */

export const RAW_GATEWAY_TEXT = "error communicating with underpinning service";
export const CORRELATION_ID = "50c7a41b-757f-440d-a4e8-eef5be144cb2";

export const upstreamFailureBody = (
  statusCode: number | null,
  source = "InDataExploration",
  payload: unknown = null,
) => ({
  code: 104,
  error: RAW_GATEWAY_TEXT,
  message: { statusCode, source, correlationId: CORRELATION_ID, payload },
});
