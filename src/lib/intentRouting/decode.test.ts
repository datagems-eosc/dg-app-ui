import { describe, expect, it } from "vitest";
import { decodeClassification } from "./decode";

const wrap = (result: unknown) => ({ result, conversationId: null });

describe("decodeClassification", () => {
  it("decodes a numeric intent with every projected field", () => {
    expect(
      decodeClassification(
        wrap({
          intent: 0,
          confidence: 0.92,
          searchQuery: "education Greece",
          degraded: false,
          model: "m",
          promptVersion: "v1",
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        intent: "dataset_search",
        retrievalQuery: "education Greece",
        degraded: false,
        confidence: 0.92,
        model: "m",
        promptVersion: "v1",
      },
    });
  });

  it.each([
    [0, "dataset_search"],
    [1, "question"],
    [2, "ambiguous"],
    [3, "out_of_scope"],
    ["dataset_search", "dataset_search"],
    ["question", "question"],
    ["ambiguous", "ambiguous"],
    ["out_of_scope", "out_of_scope"],
  ])("maps intent %j to %s", (raw, expected) => {
    const decoded = decodeClassification(
      wrap({ intent: raw, degraded: false }),
    );
    expect(decoded.ok && decoded.value.intent).toBe(expected);
  });

  it.each([[4], [-1], [1.5], ["Question"], ["search"], [""], [null], [true]])(
    "rejects unknown intent %j",
    (raw) => {
      expect(
        decodeClassification(wrap({ intent: raw, degraded: false })),
      ).toEqual({ ok: false });
    },
  );

  it("rejects a result without intent instead of defaulting to dataset search", () => {
    expect(decodeClassification(wrap({ degraded: false }))).toEqual({
      ok: false,
    });
  });

  it("rejects a result without the degraded flag instead of assuming confident", () => {
    expect(decodeClassification(wrap({ intent: 1 }))).toEqual({ ok: false });
  });

  it("rejects a non-boolean degraded flag", () => {
    expect(
      decodeClassification(wrap({ intent: 1, degraded: "false" })),
    ).toEqual({ ok: false });
  });

  it.each([[null], [undefined], [""], ["   "]])(
    "treats retrieval query %j as absent",
    (searchQuery) => {
      const decoded = decodeClassification(
        wrap({ intent: 0, degraded: false, searchQuery }),
      );
      expect(decoded.ok && decoded.value.retrievalQuery).toBeNull();
    },
  );

  it("keeps a degraded ambiguous result with zero confidence", () => {
    const decoded = decodeClassification(
      wrap({ intent: 2, degraded: true, confidence: 0 }),
    );
    expect(decoded).toEqual({
      ok: true,
      value: {
        intent: "ambiguous",
        retrievalQuery: null,
        degraded: true,
        confidence: 0,
        model: null,
        promptVersion: null,
      },
    });
  });

  it("ignores diagnostics of the wrong type", () => {
    const decoded = decodeClassification(
      wrap({ intent: 1, degraded: false, confidence: "high", model: 3 }),
    );
    expect(decoded.ok && decoded.value.confidence).toBeNull();
    expect(decoded.ok && decoded.value.model).toBeNull();
  });

  it.each([
    [null],
    ["text"],
    [[]],
    [{}],
    [{ result: null }],
    [{ result: "x" }],
  ])("rejects malformed body %j", (body) => {
    expect(decodeClassification(body)).toEqual({ ok: false });
  });
});
