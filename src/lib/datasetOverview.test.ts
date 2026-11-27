import { describe, expect, it } from "vitest";
import {
  chipsThatFit,
  cutMiddle,
  displayNames,
  presentValues,
  sameAddress,
  shortUrl,
  webUrl,
} from "./datasetOverview";

describe("presentValues", () => {
  it("drops blanks and case-insensitive repeats, keeping the first spelling", () => {
    expect(
      presentValues([" Climate", "", undefined, "climate", "  ", "EU"]),
    ).toEqual(["Climate", "EU"]);
  });

  it("is empty for a missing list", () => {
    expect(presentValues(undefined)).toEqual([]);
  });
});

describe("displayNames", () => {
  it("names one language code in full", () => {
    expect(displayNames("en", "language")).toEqual(["English"]);
  });

  it("splits the mapper's comma-joined codes and names each", () => {
    expect(displayNames("en, el,PL", "language")).toEqual([
      "English",
      "Greek",
      "Polish",
    ]);
    expect(displayNames("gr,pt, us", "region")).toEqual([
      "Greece",
      "Portugal",
      "United States",
    ]);
  });

  it("keeps names already written out and drops repeats", () => {
    expect(displayNames("English,en,Greek", "language")).toEqual([
      "English",
      "Greek",
    ]);
    expect(displayNames("GR,Greece", "region")).toEqual(["Greece"]);
  });

  it.each([undefined, "", "   ", "None", "none, ,", "zz", "xx,qq"])(
    "says nothing for absent or unknown codes %j",
    (value) => {
      expect(displayNames(value, "language")).toEqual([]);
      expect(displayNames(value, "region")).toEqual([]);
    },
  );
});

describe("webUrl", () => {
  it.each([
    ["https://example.org/a", "https://example.org/a"],
    ["  http://example.org  ", "http://example.org"],
    ["HTTPS://EXAMPLE.ORG", "HTTPS://EXAMPLE.ORG"],
  ])("accepts web address %j", (value, expected) => {
    expect(webUrl(value)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "CC BY 4.0",
    "javascript:alert(1)",
    "ftp://example.org",
    "www.example.org",
    "https://",
    "https:// not a url",
  ])("does not link %j", (value) => {
    expect(webUrl(value)).toBeUndefined();
  });
});

describe("sameAddress", () => {
  it("treats a trailing slash, scheme and host case as the same address", () => {
    expect(
      sameAddress("https://Example.org/data/", "http://example.org/data"),
    ).toBe(true);
  });

  it("keeps different paths and absent values apart", () => {
    expect(sameAddress("https://example.org/a", "https://example.org/b")).toBe(
      false,
    );
    expect(sameAddress(undefined, undefined)).toBe(false);
  });
});

describe("shortUrl", () => {
  it("drops the scheme, www and a trailing slash", () => {
    expect(shortUrl("https://www.github.com/google-deepmind/AQuA/")).toBe(
      "github.com/google-deepmind/AQuA",
    );
  });
});

describe("cutMiddle", () => {
  const fitsChars = (max: number) => (value: string) => value.length <= max;

  it("returns text that fits unchanged", () => {
    expect(cutMiddle("example.org/a", fitsChars(40))).toBe("example.org/a");
  });

  it("keeps the start and the end around one ellipsis", () => {
    const text = "archive.ics.uci.edu/dataset/544/estimation+of+obesity+levels";
    const cut = cutMiddle(text, fitsChars(30));
    expect(cut.length).toBeLessThanOrEqual(30);
    expect(cut.length).toBeGreaterThanOrEqual(28);
    expect(cut).toMatch(/^archive\.ics\.[^…]*…[^…]*levels$/);
    expect(cut.split("…")).toHaveLength(2);
  });

  it("still shows an ending when almost nothing fits", () => {
    expect(cutMiddle("abcdefghijklmnopqrstuvwxyz", fitsChars(2))).toBe("…wxyz");
  });
});

describe("chipsThatFit", () => {
  // Chips 100 px wide in a 320 px row: three per line with 6 px gaps.
  const chips = (count: number) => Array.from({ length: count }, () => 100);

  it("shows every chip that fits in two lines", () => {
    expect(chipsThatFit(chips(6), 320, 2)).toBe(6);
  });

  it("folds as soon as a third line is needed, leaving room for +N more", () => {
    // Line two keeps two chips, so "+N more" fits after them.
    expect(chipsThatFit(chips(7), 320, 2)).toBe(5);
  });

  it("keeps at least one chip on the last shown line", () => {
    const wide = [300, 300, 300];
    expect(chipsThatFit(wide, 320, 2)).toBe(2);
  });

  it("shows one chip even when it is wider than the row", () => {
    expect(chipsThatFit([900], 320, 2)).toBe(1);
  });

  it("handles an empty list", () => {
    expect(chipsThatFit([], 320, 2)).toBe(0);
  });
});
