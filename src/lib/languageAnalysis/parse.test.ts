import { describe, expect, it } from "vitest";
import {
  bareWithData,
  CONVERSATION_ID,
  DATASET_ID,
  envelopedEmpty,
  envelopedNullFields,
  envelopedWithData,
  PASSAGE_OBJECT_ID,
  passagesWithoutFeatures,
  unrecognizedEnvelope,
  wrongTypeFeatures,
} from "./fixtures";
import { parseLinguisticFeatures } from "./parse";

describe("parseLinguisticFeatures", () => {
  it("unwraps the Gateway envelope and keeps conversationId", () => {
    const outcome = parseLinguisticFeatures(envelopedWithData);

    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.result.conversationId).toBe(CONVERSATION_ID);
    expect(outcome.result.features).toHaveLength(2);
    expect(outcome.result.passages).toHaveLength(2);
  });

  it("keeps per-passage source identifiers", () => {
    const outcome = parseLinguisticFeatures(envelopedWithData);

    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(outcome.result.passages[0]).toMatchObject({
      dataset_id: DATASET_ID,
      object_id: PASSAGE_OBJECT_ID,
      similarity: 0.71,
    });
  });

  it("reads the bare payload the same way as the enveloped one", () => {
    const enveloped = parseLinguisticFeatures(envelopedWithData);
    const bare = parseLinguisticFeatures(bareWithData);

    if (enveloped.kind !== "ok" || bare.kind !== "ok") {
      throw new Error("expected ok");
    }
    expect(bare.result.features).toEqual(enveloped.result.features);
    expect(bare.result.passages).toEqual(enveloped.result.passages);
    expect(bare.result.conversationId).toBeNull();
  });

  it.each([
    ["an enveloped empty result", envelopedEmpty, 0],
    ["null fields from the Gateway", envelopedNullFields, 0],
    ["a bare payload with only rag_output", { rag_output: null }, 0],
    ["passages without features", passagesWithoutFeatures, 2],
  ])("treats %s as recognized", (_, raw, passageCount) => {
    const outcome = parseLinguisticFeatures(raw);

    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.result.features).toEqual([]);
    expect(outcome.result.passages).toHaveLength(passageCount);
  });

  it.each([
    ["a different envelope", unrecognizedEnvelope, ["count", "items"]],
    [
      "features of the wrong type",
      wrongTypeFeatures,
      ["conversationId", "result", "result.features", "result.rag_output"],
    ],
    [
      "rag_output.results of the wrong type",
      { result: { features: [], rag_output: { results: "Vienna" } } },
      ["result", "result.features", "result.rag_output"],
    ],
    [
      "a null result",
      { result: null, conversationId: null },
      ["conversationId", "result"],
    ],
    ["a string", "Vienna lies on the Danube.", []],
    ["null", null, []],
    ["an array", [{ content: "Vienna" }], []],
  ])("reports %s as unrecognized with keys only", (_, raw, keys) => {
    const outcome = parseLinguisticFeatures(raw);

    expect(outcome.kind).toBe("unrecognized");
    if (outcome.kind !== "unrecognized") return;
    expect(outcome.diagnostic.keys).toEqual(keys);
    expect(JSON.stringify(outcome.diagnostic)).not.toMatch(/Vienna/);
  });
});
