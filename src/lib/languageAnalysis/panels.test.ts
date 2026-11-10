import { describe, expect, it } from "vitest";
import {
  analysisPayload,
  bareWithData,
  envelopedEmpty,
  envelopedWithData,
  passagesWithoutFeatures,
} from "./fixtures";
import { toAnalysisPanels } from "./panels";
import { parseLinguisticFeatures } from "./parse";

const panelsFor = (raw: unknown) => {
  const outcome = parseLinguisticFeatures(raw);
  if (outcome.kind !== "ok") throw new Error("expected a recognized payload");
  return toAnalysisPanels(outcome.result);
};

describe("toAnalysisPanels", () => {
  it("fills all four panels from the enveloped response", () => {
    const panels = panelsFor(envelopedWithData);

    expect(panels.termFreqData).toEqual([
      { token: "vienna", frequency: 4 },
      { token: "danube", frequency: 2 },
    ]);
    expect(panels.sentimentData).toMatchObject({
      positive: 25,
      neutral: 70,
      negative: 5,
      totalDocs: 2,
    });
    expect(panels.sentimentData?.avgSentiment).toBeCloseTo(0.4);
    expect(panels.sentimentData?.confidence).toBeCloseTo(0.3);
    expect(panels.collocationData).toEqual([
      { bigram: "old town", frequency: 3, pmi: 5.1 },
      { bigram: "heritage site", frequency: 1, pmi: 3.2 },
    ]);
    expect(panels.retrievedTexts).toEqual([
      { content: "The old town of Vienna is a heritage site." },
      { content: "Vienna lies on the Danube." },
    ]);
  });

  it("gives the bare payload the same panel data", () => {
    expect(panelsFor(bareWithData)).toEqual(panelsFor(envelopedWithData));
  });

  it("keeps retrieved texts when features are empty", () => {
    const panels = panelsFor(passagesWithoutFeatures);

    expect(panels.retrievedTexts).toHaveLength(2);
    expect(panels.termFreqData).toEqual([]);
    expect(panels.sentimentData).toBeNull();
    expect(panels.collocationData).toEqual([]);
  });

  it("shows no sentiment when no chunk carries a sentiment profile", () => {
    const withoutProfiles = {
      result: {
        features: analysisPayload.features.map(
          ({ sentiment_profile: _omitted, ...feature }) => feature,
        ),
      },
    };
    const panels = panelsFor(withoutProfiles);

    expect(panels.sentimentData).toBeNull();
    expect(panels.termFreqData).not.toEqual([]);
  });

  it("leaves every panel empty for an empty result", () => {
    expect(panelsFor(envelopedEmpty)).toEqual({
      termFreqData: [],
      sentimentData: null,
      collocationData: [],
      retrievedTexts: [],
    });
  });
});
