import { describe, expect, it, vi } from "vitest";
import { CLASSIFY_PATH, classifyIntent, MAX_QUERY_LENGTH } from "./gateway";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const okBody = {
  result: { intent: 1, degraded: false, searchQuery: "Athens temperature" },
  conversationId: null,
};

describe("classifyIntent", () => {
  it("sends one POST with explicit projections and no conversation creation", async () => {
    const request = vi.fn().mockResolvedValue(json(200, okBody));
    const controller = new AbortController();

    await classifyIntent(request, "  mean temperature in Athens  ", {
      signal: controller.signal,
    });

    expect(request).toHaveBeenCalledTimes(1);
    const [path, init] = request.mock.calls[0];
    expect(path).toBe(CLASSIFY_PATH);
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.getAll("f")).toEqual([
      "intent",
      "confidence",
      "searchQuery",
      "degraded",
      "model",
      "promptVersion",
    ]);
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(controller.signal);
    expect(JSON.parse(init.body)).toEqual({
      query: "mean temperature in Athens",
      conversationOptions: { autoCreateConversation: false },
    });
  });

  it("returns the decoded classification", async () => {
    const request = vi.fn().mockResolvedValue(json(200, okBody));
    await expect(classifyIntent(request, "q")).resolves.toEqual({
      ok: true,
      classification: expect.objectContaining({
        intent: "question",
        retrievalQuery: "Athens temperature",
      }),
    });
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [503, "unavailable"],
    [500, "http"],
    [400, "http"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const request = vi.fn().mockResolvedValue(json(status, { error: "x" }));
    await expect(classifyIntent(request, "q")).resolves.toEqual({
      ok: false,
      kind,
    });
  });

  it("maps an undecodable 200 to invalid", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(json(200, { result: { intent: 9, degraded: false } }));
    await expect(classifyIntent(request, "q")).resolves.toEqual({
      ok: false,
      kind: "invalid",
    });
  });

  it("maps a non-JSON 200 to invalid", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(classifyIntent(request, "q")).resolves.toEqual({
      ok: false,
      kind: "invalid",
    });
  });

  it("maps a network error to network", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(classifyIntent(request, "q")).resolves.toEqual({
      ok: false,
      kind: "network",
    });
  });

  it("maps an abort to aborted", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(classifyIntent(request, "q")).resolves.toEqual({
      ok: false,
      kind: "aborted",
    });
  });

  it.each([[""], ["   "], ["x".repeat(MAX_QUERY_LENGTH + 1)]])(
    "does not call Gateway for an out-of-range query",
    async (query) => {
      const request = vi.fn();
      await expect(classifyIntent(request, query)).resolves.toEqual({
        ok: false,
        kind: "invalid",
      });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("accepts a query at the length limit", async () => {
    const request = vi.fn().mockResolvedValue(json(200, okBody));
    await classifyIntent(request, "x".repeat(MAX_QUERY_LENGTH));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
