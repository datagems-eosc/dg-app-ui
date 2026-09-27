import { describe, expect, it, vi } from "vitest";
import {
  identityCensoredProcess,
  ONBOARDING_DEFINITION_ID,
  onboardingConfigPayload,
  PROCESS_INSTANCE_ID,
  runningProcess,
  startAcceptedBody,
  startWithoutIdBody,
} from "./fixtures";
import {
  buildFieldQuery,
  createOnboardingGateway,
  type OnboardingTransport,
  PROCESS_PROJECTION,
} from "./gateway";
import {
  asProcessInstanceId,
  DATA_LOCATION_KIND,
  type OnboardingStartInput,
} from "./types";

interface Call {
  path: string;
  init: RequestInit;
}

/** Records calls and returns a scripted response; no network, no timers. */
const fakeTransport = (
  respond: (call: Call) => Response | Promise<Response> | never,
) => {
  const calls: Call[] = [];
  const transport: OnboardingTransport = async (path, init) => {
    calls.push({ path, init });
    return respond({ path, init });
  };
  return { transport, calls };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (status: number) => new Response("", { status });

const startInput: OnboardingStartInput = {
  name: "Complex numbers",
  description: "Exercises from the MathE pilot.",
  license: "CC-BY-4.0",
  headline: "Complex numbers exercise set",
  keywords: ["mathematics", "exercises"],
  fieldOfScience: ["mathematics"],
  datePublished: "2026-09-22",
  dataLocations: [
    { kind: DATA_LOCATION_KIND.Staged, location: "staged/abc123" },
  ],
};

describe("buildFieldQuery", () => {
  it("emits one encoded f= parameter per field", () => {
    expect(buildFieldQuery(["id", "steps.stepId"])).toBe(
      "?f=id&f=steps.stepId",
    );
  });

  it("returns an empty string for no fields", () => {
    expect(buildFieldQuery([])).toBe("");
  });
});

describe("getProcess", () => {
  it("issues one GET with the camelCase repeated projection and no body", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(runningProcess),
    );
    const gateway = createOnboardingGateway(transport);

    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(
      `/workflow-process/${PROCESS_INSTANCE_ID}` +
        "?f=id&f=processId&f=status&f=dataset.id&f=steps.id&f=steps.stepId&f=steps.status",
    );
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
    // The injected transport already applies /gw/api; adding it here would
    // produce /gw/api/gw/api/...
    expect(calls[0].path.startsWith("/workflow-process/")).toBe(true);
    expect(result.ok && result.value.processInstanceId).toBe(
      PROCESS_INSTANCE_ID,
    );
  });

  it("always requests id and status alongside the nested projections", () => {
    // A steps-only field set can be censored to nothing and 403 the whole read.
    expect(PROCESS_PROJECTION).toContain("id");
    expect(PROCESS_PROJECTION).toContain("status");
  });

  it("does not request workflowTaskInstanceDetails", () => {
    expect(PROCESS_PROJECTION).not.toContain("workflowTaskInstanceDetails");
  });

  it("percent-encodes the process id", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(runningProcess),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.getProcess(asProcessInstanceId("a b/c"));
    expect(calls[0].path.startsWith("/workflow-process/a%20b%2Fc?")).toBe(true);
  });

  it("decodes a single object rather than a list wrapper", async () => {
    // The Swagger annotation claims QueryResult<T>; the action returns one
    // object. A wrapper must not decode.
    const { transport } = fakeTransport(() =>
      jsonResponse({ items: [runningProcess], count: 1 }),
    );
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("malformed");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "unavailable-reference"],
    [500, "transient"],
    [503, "transient"],
  ])("classifies HTTP %i as %s", async (status, kind) => {
    const { transport } = fakeTransport(() => errorResponse(status));
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe(kind);
  });

  it("classifies a non-JSON 200 as malformed, not as failure or denial", async () => {
    const { transport } = fakeTransport(
      () => new Response("<html>gateway</html>", { status: 200 }),
    );
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toEqual({ kind: "malformed", httpStatus: 200 });
  });

  it("classifies a censored 200 as malformed and keeps the decode detail", async () => {
    const { transport } = fakeTransport(() =>
      jsonResponse(identityCensoredProcess),
    );
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("malformed");
    expect(result.failure).toMatchObject({
      failure: { code: "missing-required", path: "id" },
    });
  });

  it("classifies a network rejection as transient without retrying", async () => {
    const { transport, calls } = fakeTransport(() => {
      throw new TypeError("Failed to fetch");
    });
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("transient");
  });

  it("forwards the AbortSignal and reports cancellation", async () => {
    const controller = new AbortController();
    const { transport, calls } = fakeTransport(({ init }) => {
      expect(init.signal).toBe(controller.signal);
      const error = new DOMException("Aborted", "AbortError");
      throw error;
    });
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
      controller.signal,
    );
    expect(calls[0].init.signal).toBe(controller.signal);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("cancelled");
  });
});

describe("getConfig", () => {
  it("issues one GET to the config route with no field set and no body", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(onboardingConfigPayload),
    );
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getConfig();

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/workflow-process/config");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
    expect(result.ok && result.value.items).toHaveLength(2);
  });

  it("reports a config failure without hiding it as success", async () => {
    const { transport } = fakeTransport(() => errorResponse(403));
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("forbidden");
  });
});

describe("start", () => {
  it("POSTs the explicit DatasetPersist mapping with f=id", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(startAcceptedBody),
    );
    const gateway = createOnboardingGateway(transport);
    const outcome = await gateway.start(startInput);

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/workflow-process/onboard?f=id");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      name: "Complex numbers",
      description: "Exercises from the MathE pilot.",
      license: "CC-BY-4.0",
      headline: "Complex numbers exercise set",
      keywords: ["mathematics", "exercises"],
      fieldOfScience: ["mathematics"],
      datePublished: "2026-09-22",
      dataLocations: [{ kind: 4, location: "staged/abc123" }],
    });
    expect(outcome).toEqual({
      kind: "accepted",
      processInstanceId: PROCESS_INSTANCE_ID,
    });
  });

  it("never sends a dataset id: OnboardValidator rejects it as overposting", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(startAcceptedBody),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.start(startInput);
    expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty("id");
  });

  it("omits optional properties that were not supplied", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(startAcceptedBody),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.start(startInput);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).not.toHaveProperty("doi");
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("citeAs");
  });

  it("includes optional properties when supplied", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(startAcceptedBody),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.start({
      ...startInput,
      language: ["en"],
      country: ["PL"],
      url: "https://example.org/d",
      citeAs: "Example",
      doi: "10.1234/abc",
    });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      language: ["en"],
      country: ["PL"],
      url: "https://example.org/d",
      citeAs: "Example",
      doi: "10.1234/abc",
    });
  });

  it("treats a 2xx body without id as unknown, not accepted or failed", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(startWithoutIdBody),
    );
    const gateway = createOnboardingGateway(transport);
    const outcome = await gateway.start(startInput);

    expect(outcome.kind).toBe("unknown");
    // Crucially: no second attempt. The mutation may have been accepted.
    expect(calls).toHaveLength(1);
  });

  it.each([400, 401])(
    "treats HTTP %i as a definite rejection: nothing was persisted",
    async (status) => {
      // 400 comes from the model-state and OnboardValidator filters, 401 from
      // the [Authorize] attribute and authentication middleware. All run before
      // the action body, so no process row can exist.
      const { transport, calls } = fakeTransport(() => errorResponse(status));
      const gateway = createOnboardingGateway(transport);
      const outcome = await gateway.start(startInput);
      expect(outcome).toEqual({ kind: "rejected", httpStatus: status });
      expect(calls).toHaveLength(1);
    },
  );

  it("treats HTTP 403 as an unknown outcome, keeping the forbidden detail", async () => {
    // ExecuteOnboardingFlow authorizes CanExecuteDatasetOnboarding (:198),
    // persists via PersistFlow (:202), and only then runs ExecuteOnboarding,
    // whose first statement authorizes OnboardDataset (:397) — after the rows
    // exist. The two permissions carry different roles in the checked-in
    // defaults, so a 403 can follow persistence and cannot be a rejection.
    const { transport, calls } = fakeTransport(() => errorResponse(403));
    const gateway = createOnboardingGateway(transport);
    const outcome = await gateway.start(startInput);

    expect(outcome).toEqual({
      kind: "unknown",
      failure: { kind: "forbidden", httpStatus: 403 },
    });
    expect(outcome.kind).not.toBe("rejected");
    // No retry: the attempt may have created a process.
    expect(calls).toHaveLength(1);
  });

  it("keeps read 403 classification unchanged", async () => {
    // Only the start mutation's outcome mapping moved; a forbidden read is
    // still simply forbidden.
    const { transport } = fakeTransport(() => errorResponse(403));
    const gateway = createOnboardingGateway(transport);
    const result = await gateway.getProcess(
      asProcessInstanceId(PROCESS_INSTANCE_ID),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toEqual({ kind: "forbidden", httpStatus: 403 });
  });

  it.each([404, 409, 500, 503])(
    "treats HTTP %i as an unknown outcome and never retries",
    async (status) => {
      // The service can raise after PersistFlow has already created the rows,
      // so these cannot be claimed as "no start happened".
      const { transport, calls } = fakeTransport(() => errorResponse(status));
      const gateway = createOnboardingGateway(transport);
      const outcome = await gateway.start(startInput);
      expect(outcome.kind).toBe("unknown");
      expect(calls).toHaveLength(1);
    },
  );

  it("treats a lost response as unknown and never retries", async () => {
    const { transport, calls } = fakeTransport(() => {
      throw new TypeError("Failed to fetch");
    });
    const gateway = createOnboardingGateway(transport);
    const outcome = await gateway.start(startInput);
    expect(outcome).toEqual({
      kind: "unknown",
      failure: { kind: "transient" },
    });
    expect(calls).toHaveLength(1);
  });

  it("treats an unparseable 2xx as unknown", async () => {
    const { transport } = fakeTransport(
      () => new Response("not json", { status: 200 }),
    );
    const gateway = createOnboardingGateway(transport);
    const outcome = await gateway.start(startInput);
    expect(outcome.kind).toBe("unknown");
  });

  it("treats a local abort as unknown because the server may have accepted", async () => {
    const controller = new AbortController();
    const { transport } = fakeTransport(() => {
      throw new DOMException("Aborted", "AbortError");
    });
    const gateway = createOnboardingGateway(transport);
    const outcome = await gateway.start(startInput, controller.signal);
    expect(outcome).toEqual({
      kind: "unknown",
      failure: { kind: "cancelled" },
    });
  });

  it("forwards the AbortSignal", async () => {
    const controller = new AbortController();
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(startAcceptedBody),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.start(startInput, controller.signal);
    expect(calls[0].init.signal).toBe(controller.signal);
  });
});

describe("adapter boundaries", () => {
  it("performs exactly one transport call per operation", async () => {
    const transport = vi.fn<OnboardingTransport>(async () =>
      jsonResponse(runningProcess),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.getProcess(asProcessInstanceId(PROCESS_INSTANCE_ID));
    expect(transport).toHaveBeenCalledTimes(1);

    transport.mockClear();
    transport.mockResolvedValue(jsonResponse(onboardingConfigPayload));
    await gateway.getConfig();
    expect(transport).toHaveBeenCalledTimes(1);

    transport.mockClear();
    transport.mockResolvedValue(jsonResponse(startAcceptedBody));
    await gateway.start(startInput);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("keeps the process definition id out of the instance lookup path", async () => {
    const { transport, calls } = fakeTransport(() =>
      jsonResponse(runningProcess),
    );
    const gateway = createOnboardingGateway(transport);
    await gateway.getProcess(asProcessInstanceId(PROCESS_INSTANCE_ID));
    expect(calls[0].path).not.toContain(ONBOARDING_DEFINITION_ID);
  });
});
