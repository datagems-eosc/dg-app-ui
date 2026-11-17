import { describe, expect, it } from "vitest";
import type { HierarchicalCategory } from "@/components/ui/HierarchicalDropdown";
import {
  fieldOfScienceFilterValues,
  fieldOfScienceLabels,
  toFieldOfScienceOptionValues,
} from "./fieldsOfScience";

/**
 * Categories in the shape `processFieldsOfScience` produces: the option value
 * is the vocabulary name as the Gateway returns it, the label is sentence case.
 * `MATERIALS ENGINEERING` really is listed under two codes in the Gateway
 * vocabulary (`2.5` and `3.5`).
 */
const categories: HierarchicalCategory[] = [
  {
    name: "Natural sciences",
    code: "1",
    options: [
      { value: "MATHEMATICS", label: "Mathematics", code: "1.1" },
      {
        value: "COMPUTER AND INFORMATION SCIENCES",
        label: "Computer and information sciences",
        code: "1.2",
      },
    ],
  },
  {
    name: "Engineering and technology",
    code: "2",
    options: [
      {
        value: "MATERIALS ENGINEERING",
        label: "Materials engineering",
        code: "2.5",
      },
    ],
  },
  {
    name: "Medical and health sciences",
    code: "3",
    options: [
      {
        value: "MATERIALS ENGINEERING",
        label: "Materials engineering",
        code: "3.5",
      },
    ],
  },
  {
    name: "Agricultural sciences",
    code: "4",
    options: [
      {
        value: "AGRICULTURE, FORESTRY, AND FISHERIES",
        label: "Agriculture, forestry, and fisheries",
        code: "4.1",
      },
    ],
  },
];

describe("fieldOfScienceLabels", () => {
  it("shows a stored code by its readable name", () => {
    expect(fieldOfScienceLabels(["1.1"], categories)).toEqual(["Mathematics"]);
  });

  it("shows a stored name in any casing, with stray spaces, in readable casing", () => {
    expect(
      fieldOfScienceLabels(
        ["COMPUTER AND INFORMATION SCIENCES", "  mathematics "],
        categories,
      ),
    ).toEqual(["Computer and information sciences", "Mathematics"]);
  });

  it("shows a stored top-level category by its readable name", () => {
    expect(
      fieldOfScienceLabels(
        ["NATURAL SCIENCES", "Natural sciences", "4"],
        categories,
      ),
    ).toEqual(["Natural sciences", "Agricultural sciences"]);
  });

  it("keeps a value the vocabulary does not know exactly as stored", () => {
    expect(
      fieldOfScienceLabels(["dataset-test-A", "9.9", ""], categories),
    ).toEqual(["dataset-test-A", "9.9", ""]);
  });

  it("shows a field stored as both code and name once", () => {
    expect(fieldOfScienceLabels(["1.1", "MATHEMATICS"], categories)).toEqual([
      "Mathematics",
    ]);
  });

  it("returns nothing for no values", () => {
    expect(fieldOfScienceLabels([], categories)).toEqual([]);
  });
});

describe("toFieldOfScienceOptionValues", () => {
  it("turns stored codes and names into the dropdown's option values", () => {
    expect(
      toFieldOfScienceOptionValues(["4.1", "Mathematics"], categories),
    ).toEqual(["AGRICULTURE, FORESTRY, AND FISHERIES", "MATHEMATICS"]);
  });

  it("drops values that match no field, including bare categories, and repeats", () => {
    expect(
      toFieldOfScienceOptionValues(
        ["dataset-test-A", "NATURAL SCIENCES", "1.1", "mathematics"],
        categories,
      ),
    ).toEqual(["MATHEMATICS"]);
  });

  it("selects nothing while the vocabulary is not loaded", () => {
    expect(toFieldOfScienceOptionValues(["1.1"], [])).toEqual([]);
  });
});

describe("fieldOfScienceFilterValues", () => {
  it("sends each selected name with its code", () => {
    expect(fieldOfScienceFilterValues(["MATHEMATICS"], categories)).toEqual([
      "MATHEMATICS",
      "1.1",
    ]);
  });

  it("sends two names and two codes for two fields", () => {
    expect(
      fieldOfScienceFilterValues(
        ["MATHEMATICS", "COMPUTER AND INFORMATION SCIENCES"],
        categories,
      ),
    ).toEqual([
      "MATHEMATICS",
      "1.1",
      "COMPUTER AND INFORMATION SCIENCES",
      "1.2",
    ]);
  });

  it("sends every code of a name the vocabulary lists twice, once", () => {
    expect(
      fieldOfScienceFilterValues(["MATERIALS ENGINEERING"], categories),
    ).toEqual(["MATERIALS ENGINEERING", "2.5", "3.5"]);
  });

  it("sends the names alone while the vocabulary is not loaded", () => {
    expect(fieldOfScienceFilterValues(["MATHEMATICS"], [])).toEqual([
      "MATHEMATICS",
    ]);
  });

  it("sends nothing for no selection", () => {
    expect(fieldOfScienceFilterValues([], categories)).toEqual([]);
  });
});
