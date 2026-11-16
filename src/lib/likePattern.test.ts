import { describe, expect, it } from "vitest";
import { toLikePattern } from "./likePattern";

describe("toLikePattern", () => {
  it("matches plain text anywhere", () => {
    expect(toLikePattern("wiki")).toBe("%wiki%");
  });

  it("escapes an underscore so it matches literally", () => {
    expect(toLikePattern("air_quality")).toBe("%air\\_quality%");
  });

  it("escapes a percent sign so it matches literally", () => {
    expect(toLikePattern("100%")).toBe("%100\\%%");
  });

  it("escapes a backslash before the wildcards", () => {
    expect(toLikePattern("a\\_b")).toBe("%a\\\\\\_b%");
  });

  it("escapes every occurrence", () => {
    expect(toLikePattern("_%_")).toBe("%\\_\\%\\_%");
  });
});
