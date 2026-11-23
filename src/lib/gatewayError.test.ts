import { describe, expect, it } from "vitest";
import {
  GatewayError,
  GatewayErrorKind,
  gatewayErrorFromNetworkFailure,
  gatewayErrorFromResponse,
} from "./gatewayError";
import {
  CORRELATION_ID,
  upstreamFailureBody as upstreamFailure,
} from "./gatewayError.fixtures";

const UNANSWERABLE_PAYLOAD = JSON.stringify({
  code: 102,
  error: "validation error",
  message: [
    {
      Key: "question",
      Value: ["The question cannot be answered from this dataset."],
    },
  ],
});

describe("gatewayErrorFromResponse", () => {
  it.each([
    ["400 with the payload as a JSON string", 400, UNANSWERABLE_PAYLOAD],
    ["422 with a payload", 422, UNANSWERABLE_PAYLOAD],
    [
      "400 with the payload as an object",
      400,
      JSON.parse(UNANSWERABLE_PAYLOAD),
    ],
  ])(
    "shows the service's own message for an unanswerable question (%s)",
    (_, upstream, payload) => {
      const error = gatewayErrorFromResponse(
        424,
        upstreamFailure(upstream, "InDataExploration", payload),
      );

      expect(error).toBeInstanceOf(GatewayError);
      expect(error.kind).toBe(GatewayErrorKind.Unanswerable);
      expect(error.message).toBe(
        "The question cannot be answered from this dataset. Reference: 50c7a41b",
      );
      expect(error.message).not.toContain("underpinning service");
    },
  );

  it.each([
    ["422 without a payload", upstreamFailure(422)],
    [
      "400 with a payload that is not JSON",
      upstreamFailure(400, undefined, "{"),
    ],
    [
      "400 with a payload without messages",
      upstreamFailure(400, undefined, JSON.stringify({ code: 102 })),
    ],
  ])("uses the rephrase copy for an unanswerable question (%s)", (_, body) => {
    const error = gatewayErrorFromResponse(424, body);

    expect(error.kind).toBe(GatewayErrorKind.Unanswerable);
    expect(error.message).toBe(
      "This question can't be answered from the selected data. Try rephrasing it. Reference: 50c7a41b",
    );
  });

  it.each([
    ["an upstream 500", 424, upstreamFailure(500)],
    [
      "an upstream 503 from another service",
      424,
      upstreamFailure(503, "DataManagement"),
    ],
    ["an unreachable upstream (null status)", 424, upstreamFailure(null)],
    [
      "a Gateway 500",
      500,
      {
        code: 101,
        error: "internal",
        message: { correlationId: CORRELATION_ID },
      },
    ],
  ])("uses the unavailable copy for %s", (_, status, body) => {
    const error = gatewayErrorFromResponse(status, body);

    expect(error.kind).toBe(GatewayErrorKind.Unavailable);
    expect(error.message).toBe(
      "The service is temporarily unavailable. Please try again. Reference: 50c7a41b",
    );
  });

  it.each([
    [
      "a Gateway 4xx of its own",
      400,
      {
        code: 102,
        error: "validation error",
        message: { correlationId: CORRELATION_ID },
      },
    ],
    [
      "an upstream 4xx from another service",
      424,
      upstreamFailure(400, "CrossDatasetDiscovery", UNANSWERABLE_PAYLOAD),
    ],
  ])("uses the generic copy for %s", (_, status, body) => {
    const error = gatewayErrorFromResponse(status, body);

    expect(error.kind).toBe(GatewayErrorKind.Generic);
    expect(error.message).toBe(
      "Something went wrong. Please try again. Reference: 50c7a41b",
    );
    expect(error.message).not.toContain("validation error");
    expect(error.message).not.toContain("cannot be answered");
  });

  it.each([
    ["a body that is not a Gateway error", 403, "Forbidden"],
    ["an empty body", 404, {}],
    ["no body", 409, undefined],
  ])("uses the generic copy without a reference for %s", (_, status, body) => {
    const error = gatewayErrorFromResponse(status, body);

    expect(error.kind).toBe(GatewayErrorKind.Generic);
    expect(error.message).toBe("Something went wrong. Please try again.");
  });

  it("keeps the classification details for logging", () => {
    const error = gatewayErrorFromResponse(424, upstreamFailure(422));

    expect(error.details).toMatchObject({
      status: 424,
      code: 104,
      source: "InDataExploration",
      upstreamStatus: 422,
      correlationId: CORRELATION_ID,
    });
  });
});

describe("gatewayErrorFromNetworkFailure", () => {
  it.each([
    ["a network error", new TypeError("Failed to fetch")],
    ["a timeout", new DOMException("signal timed out", "TimeoutError")],
  ])("uses the unavailable copy without a reference for %s", (_, cause) => {
    const error = gatewayErrorFromNetworkFailure(cause);

    expect(error).toBeInstanceOf(GatewayError);
    expect(error.kind).toBe(GatewayErrorKind.Unavailable);
    expect(error.details.status).toBeNull();
    expect(error.message).toBe(
      "The service is temporarily unavailable. Please try again.",
    );
  });
});
