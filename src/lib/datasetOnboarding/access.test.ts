import { describe, expect, it, vi } from "vitest";
import { createDatasetAccessReader } from "./access";
import { DATASET_ID } from "./fixtures";
import type { OnboardingTransport } from "./gateway";
import { asDatasetId } from "./types";

const DATASET = asDatasetId(DATASET_ID);

interface Call {
  readonly path: string;
  readonly init: RequestInit;
}

const reader = (respond: (call: number) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const transport: OnboardingTransport = async (path, init) => {
    calls.push({ path, init });
    return respond(calls.length);
  };
  return { calls, reader: createDatasetAccessReader(transport) };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const status = (code: number) => new Response(null, { status: code });

describe("the dataset access reader", () => {
  // --- request shape -------------------------------------------------------

  it("reads one dataset by id with one f= per projected field", async () => {
    const { calls, reader: read } = reader(() =>
      json({ id: DATASET_ID, name: "Athens air quality 2024" }),
    );

    await read.readDataset(DATASET);

    expect(calls).toHaveLength(1);
    // Relative to the transport's own `/gw/api` prefix, which it must not repeat.
    expect(calls[0]?.path).toBe(`/dataset/${DATASET_ID}?f=id&f=name`);
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("encodes an id that would otherwise change the path", async () => {
    const { calls, reader: read } = reader(() => json({ id: "a/b?c#d" }));
    await read.readDataset(asDatasetId("a/b?c#d"));
    expect(calls[0]?.path).toBe("/dataset/a%2Fb%3Fc%23d?f=id&f=name");
  });

  it("forwards the caller's abort signal", async () => {
    const controller = new AbortController();
    const { calls, reader: read } = reader(() => json({ id: DATASET_ID }));
    await read.readDataset(DATASET, controller.signal);
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });

  it("performs exactly one request per operation", async () => {
    const { calls, reader: read } = reader(() => status(500));
    await read.readDataset(DATASET);
    expect(calls).toHaveLength(1);
  });

  // --- readable ------------------------------------------------------------

  it("confirms readability from a single object whose id is the one requested", async () => {
    const { reader: read } = reader(() =>
      json({ id: DATASET_ID, name: "Athens air quality 2024" }),
    );

    await expect(read.readDataset(DATASET)).resolves.toEqual({
      kind: "readable",
      datasetId: DATASET_ID,
      name: "Athens air quality 2024",
    });
  });

  it("treats the name as optional", async () => {
    const { reader: read } = reader(() => json({ id: DATASET_ID }));
    const outcome = await read.readDataset(DATASET);
    expect(outcome).toEqual({ kind: "readable", datasetId: DATASET_ID });
  });

  it.each([
    ["a non-string name", 42],
    ["an empty name", "   "],
    ["a name carrying control characters", "one\u0007two"],
  ])("stays readable but drops %s", async (_label, name) => {
    const { reader: read } = reader(() => json({ id: DATASET_ID, name }));
    const outcome = await read.readDataset(DATASET);
    expect(outcome).toEqual({ kind: "readable", datasetId: DATASET_ID });
  });

  // --- shapes that must never confirm --------------------------------------

  it("refuses to confirm when the body is a query wrapper", async () => {
    // The Swagger annotation names QueryResult; the action does not return one.
    // Unwrapping it anyway would be guessing at an unobserved contract.
    const { reader: read } = reader(() =>
      json({ items: [{ id: DATASET_ID }], count: 1 }),
    );
    await expect(read.readDataset(DATASET)).resolves.toEqual({
      kind: "unknown",
      reason: "malformed",
      httpStatus: 200,
    });
  });

  it("refuses to confirm from an array", async () => {
    const { reader: read } = reader(() => json([{ id: DATASET_ID }]));
    const outcome = await read.readDataset(DATASET);
    expect(outcome).toMatchObject({ kind: "unknown", reason: "malformed" });
  });

  it.each([
    ["a missing id", {}],
    ["a blank id", { id: "   " }],
    ["a non-string id", { id: 7 }],
  ])("refuses to confirm with %s", async (_label, body) => {
    const { reader: read } = reader(() => json(body));
    const outcome = await read.readDataset(DATASET);
    expect(outcome).toMatchObject({ kind: "unknown", reason: "malformed" });
  });

  it("refuses to confirm when the id is not the one requested", async () => {
    const { reader: read } = reader(() =>
      json({ id: "11111111-2222-3333-4444-555555555555", name: "Other" }),
    );

    const outcome = await read.readDataset(DATASET);
    // Never "readable" for a dataset we did not ask about, and never the other
    // dataset's name.
    expect(outcome).toEqual({
      kind: "unknown",
      reason: "identity-mismatch",
      httpStatus: 200,
    });
  });

  it("refuses to confirm from an unreadable body", async () => {
    const { reader: read } = reader(
      () => new Response("not json", { status: 200 }),
    );
    const outcome = await read.readDataset(DATASET);
    expect(outcome).toMatchObject({ kind: "unknown", reason: "malformed" });
  });

  // --- classification ------------------------------------------------------

  it.each([
    [401, { kind: "auth-unusable", httpStatus: 401 }],
    [403, { kind: "denied", httpStatus: 403 }],
    [404, { kind: "unavailable", httpStatus: 404 }],
  ])("classifies %i distinctly", async (code, expected) => {
    const { reader: read } = reader(() => status(code));
    await expect(read.readDataset(DATASET)).resolves.toEqual(expected);
  });

  it.each([400, 500, 503])(
    "leaves %i unknown rather than denying or confirming",
    async (code) => {
      const { reader: read } = reader(() => status(code));
      await expect(read.readDataset(DATASET)).resolves.toEqual({
        kind: "unknown",
        reason: "transient",
        httpStatus: code,
      });
    },
  );

  it("never claims deletion from a 404", async () => {
    const { reader: read } = reader(() => status(404));
    const outcome = await read.readDataset(DATASET);
    expect(outcome.kind).toBe("unavailable");
    expect(JSON.stringify(outcome)).not.toMatch(/delet/i);
  });

  it("reports a transport failure as unknown, not as denial", async () => {
    const transport: OnboardingTransport = () =>
      Promise.reject(new Error("network down"));
    const outcome =
      await createDatasetAccessReader(transport).readDataset(DATASET);
    expect(outcome).toEqual({ kind: "unknown", reason: "transient" });
  });

  it("reports an unresolved identity as unknown, having sent nothing", async () => {
    // This is what the `useApi` transport does when no scope is resolved.
    const transport = vi.fn(() => Promise.reject(new Error("NO_AUTH_TOKEN")));
    const outcome =
      await createDatasetAccessReader(transport).readDataset(DATASET);
    expect(outcome).toEqual({ kind: "unknown", reason: "transient" });
  });

  // --- cancellation --------------------------------------------------------

  it("reports an aborted request as cancelled, never as evidence", async () => {
    const transport: OnboardingTransport = () =>
      Promise.reject(
        new DOMException("The operation was aborted.", "AbortError"),
      );
    const outcome =
      await createDatasetAccessReader(transport).readDataset(DATASET);
    expect(outcome).toEqual({ kind: "cancelled" });
  });

  it("reports an abort during body decoding as cancelled, not malformed", async () => {
    const response = {
      ok: true,
      status: 200,
      json: () =>
        Promise.reject(
          new DOMException("The operation was aborted.", "AbortError"),
        ),
    } as unknown as Response;

    const outcome = await createDatasetAccessReader(
      async () => response,
    ).readDataset(DATASET);
    expect(outcome).toEqual({ kind: "cancelled" });
  });

  // --- boundary ------------------------------------------------------------

  it("asks for nothing beyond id and name", async () => {
    const { calls, reader: read } = reader(() => json({ id: DATASET_ID }));
    await read.readDataset(DATASET);

    const path = calls[0]?.path ?? "";
    for (const forbidden of [
      "permissions",
      "features",
      "collections",
      "profileRaw",
      "status",
    ]) {
      expect(path).not.toContain(forbidden);
    }
    // No grant, profile, search or permission endpoint is touched.
    expect(path.startsWith("/dataset/")).toBe(true);
  });
});
