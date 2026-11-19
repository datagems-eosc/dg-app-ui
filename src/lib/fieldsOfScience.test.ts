import { describe, expect, it } from "vitest";
import type { HierarchicalCategory } from "@/components/ui/HierarchicalDropdown";
import {
  fieldOfScienceCodes,
  fieldOfScienceFilterValues,
  fieldOfScienceLabels,
  fieldOfScienceNames,
} from "./fieldsOfScience";

const field = (code: string, name: string) => ({
  value: name,
  label: name.charAt(0) + name.slice(1).toLowerCase(),
  code,
});

/**
 * Categories in the shape `processFieldsOfScience` produces: the option value
 * is the vocabulary name as the Gateway returns it, the label its sentence
 * case, and the dropdown selects by code. `MATERIALS ENGINEERING` really is
 * listed under two codes in the Gateway vocabulary (`2.5` and `3.5`).
 */
const categories: HierarchicalCategory[] = [
  {
    name: "Natural sciences",
    code: "1",
    options: [
      field("1.1", "MATHEMATICS"),
      field("1.2", "COMPUTER AND INFORMATION SCIENCES"),
    ],
  },
  {
    name: "Engineering and technology",
    code: "2",
    options: [field("2.5", "MATERIALS ENGINEERING")],
  },
  {
    name: "Medical and health sciences",
    code: "3",
    options: [field("3.5", "MATERIALS ENGINEERING")],
  },
  {
    name: "Agricultural sciences",
    code: "4",
    options: [field("4.1", "AGRICULTURE, FORESTRY, AND FISHERIES")],
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

describe("fieldOfScienceNames", () => {
  it("turns selected codes into the vocabulary names", () => {
    expect(fieldOfScienceNames(["1.1", "4.1"], categories)).toEqual([
      "MATHEMATICS",
      "AGRICULTURE, FORESTRY, AND FISHERIES",
    ]);
  });

  it("sends the name of a code whose name the vocabulary repeats, once for both codes", () => {
    expect(fieldOfScienceNames(["2.5"], categories)).toEqual([
      "MATERIALS ENGINEERING",
    ]);
    expect(fieldOfScienceNames(["3.5"], categories)).toEqual([
      "MATERIALS ENGINEERING",
    ]);
    expect(fieldOfScienceNames(["2.5", "3.5"], categories)).toEqual([
      "MATERIALS ENGINEERING",
    ]);
  });

  it("turns a stored name in other casing into the vocabulary name", () => {
    expect(fieldOfScienceNames(["Mathematics"], categories)).toEqual([
      "MATHEMATICS",
    ]);
  });

  it("keeps values the vocabulary does not know, or all values before it loads", () => {
    expect(fieldOfScienceNames(["dataset-test-A"], categories)).toEqual([
      "dataset-test-A",
    ]);
    expect(fieldOfScienceNames(["1.1"], [])).toEqual(["1.1"]);
  });

  it("returns nothing for no selection", () => {
    expect(fieldOfScienceNames([], categories)).toEqual([]);
  });
});

describe("fieldOfScienceCodes", () => {
  it("turns stored codes and names into the codes the dropdown selects", () => {
    expect(fieldOfScienceCodes(["4.1", "Mathematics"], categories)).toEqual([
      "4.1",
      "1.1",
    ]);
  });

  it("selects one row for a stored code whose name the vocabulary repeats", () => {
    expect(fieldOfScienceCodes(["3.5"], categories)).toEqual(["3.5"]);
  });

  it("selects the first listed row for a stored name the vocabulary repeats", () => {
    expect(fieldOfScienceCodes(["MATERIALS ENGINEERING"], categories)).toEqual([
      "2.5",
    ]);
  });

  it("drops values that match no field, including bare categories, and repeats", () => {
    expect(
      fieldOfScienceCodes(
        ["dataset-test-A", "NATURAL SCIENCES", "1.1", "mathematics"],
        categories,
      ),
    ).toEqual(["1.1"]);
  });

  it("selects nothing while the vocabulary is not loaded", () => {
    expect(fieldOfScienceCodes(["1.1"], [])).toEqual([]);
  });
});

describe("fieldOfScienceFilterValues", () => {
  it("sends each selected field's name with its code", () => {
    expect(fieldOfScienceFilterValues(["1.1"], categories)).toEqual([
      "MATHEMATICS",
      "1.1",
    ]);
  });

  it("sends two names and two codes for two fields", () => {
    expect(fieldOfScienceFilterValues(["1.1", "1.2"], categories)).toEqual([
      "MATHEMATICS",
      "1.1",
      "COMPUTER AND INFORMATION SCIENCES",
      "1.2",
    ]);
  });

  it("sends only the selected code of a name the vocabulary repeats", () => {
    expect(fieldOfScienceFilterValues(["2.5"], categories)).toEqual([
      "MATERIALS ENGINEERING",
      "2.5",
    ]);
  });

  it("sends a repeated name once when both of its codes are selected", () => {
    expect(fieldOfScienceFilterValues(["2.5", "3.5"], categories)).toEqual([
      "MATERIALS ENGINEERING",
      "2.5",
      "3.5",
    ]);
  });

  it("sends the selected values as they are while the vocabulary is not loaded", () => {
    expect(fieldOfScienceFilterValues(["1.1"], [])).toEqual(["1.1"]);
  });

  it("sends nothing for no selection", () => {
    expect(fieldOfScienceFilterValues([], categories)).toEqual([]);
  });
});
