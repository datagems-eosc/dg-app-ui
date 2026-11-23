import { describe, expect, it } from "vitest";
import { featuresFromBody } from "./datasetFeatures";

describe("featuresFromBody", () => {
  it("reads the three flags of a dataset", () => {
    expect(
      featuresFromBody({
        id: "d1",
        features: { profiled: true, packaged: false, recommendation: false },
      }),
    ).toEqual({ profiled: true, packaged: false, recommendation: false });
  });

  it("leaves out a flag that is missing or not a boolean, so it never reads as false", () => {
    expect(
      featuresFromBody({ features: { profiled: "yes", recommendation: null } }),
    ).toEqual({});
  });

  it.each([
    ["no features field", { id: "d1" }],
    ["features that is not an object", { features: [true] }],
    ["features set to null", { features: null }],
    ["a body that is not an object", "nope"],
    ["no body", null],
  ])("returns null for %s", (_, body) => {
    expect(featuresFromBody(body)).toBeNull();
  });
});
