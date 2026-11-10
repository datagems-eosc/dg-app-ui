import { describe, expect, it } from "vitest";
import {
  bareWithData,
  CONVERSATION_ID,
  DATASET_ID,
  envelopedAllFieldsOmitted,
  envelopedEmpty,
  envelopedNullFields,
  envelopedWithData,
  envelopedWithoutConversationId,
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

  it("reads the dev envelope that omits a null conversationId", () => {
    const outcome = parseLinguisticFeatures(envelopedWithoutConversationId);

    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(outcome.result.conversationId).toBeNull();
    expect(outcome.result.features).toHaveLength(2);
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
    ["an envelope whose fields were all omitted", envelopedAllFieldsOmitted, 0],
    ["passages without features", passagesWithoutFeatures, 2],
    ["a bare payload whose fields were all omitted", {}, 0],
    ["a bare payload with only used_chunks", { used_chunks: [] }, 0],
  ])("treats %s as recognized", (_, raw, passageCount) => {
    const outcome = parseLinguisticFeatures(raw);

    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.result.features).toEqual([]);
    expect(outcome.result.passages).toHaveLength(passageCount);
  });

  it.each([
    ["a different envelope", unrecognizedEnvelope, [], 2],
    [
      "an envelope around a different payload",
      { result: { Vienna: 3, items: [] }, conversationId: null },
      ["conversationId", "result"],
      2,
    ],
    [
      "features of the wrong type",
      wrongTypeFeatures,
      ["conversationId", "result", "result.features", "result.rag_output"],
      0,
    ],
    [
      "features entries that are not objects",
      { result: { features: ["Vienna"], rag_output: null } },
      ["result", "result.features", "result.rag_output"],
      0,
    ],
    [
      "rag_output.results of the wrong type",
      { result: { features: [], rag_output: { results: "Vienna" } } },
      ["result", "result.features", "result.rag_output"],
      0,
    ],
    [
      "passages that are not objects",
      { result: { rag_output: { results: ["Vienna"] } } },
      ["result", "result.rag_output"],
      0,
    ],
    [
      "a null result",
      { result: null, conversationId: null },
      ["conversationId", "result"],
      0,
    ],
    ["a string", "Vienna lies on the Danube.", [], 0],
    ["null", null, [], 0],
    ["an array", [{ content: "Vienna" }], [], 0],
  ])(
    "reports %s as unrecognized with schema keys only",
    (_, raw, keys, unknownKeyCount) => {
      const outcome = parseLinguisticFeatures(raw);

      expect(outcome.kind).toBe("unrecognized");
      if (outcome.kind !== "unrecognized") return;
      expect(outcome.diagnostic.keys).toEqual(keys);
      expect(outcome.diagnostic.unknownKeyCount).toBe(unknownKeyCount);
      expect(JSON.stringify(outcome.diagnostic)).not.toMatch(/Vienna/);
    },
  );
});
