import { beforeEach, describe, expect, it, vi } from "vitest";

// The service caches the processed vocabulary per module; load a fresh copy
// for every test.
const load = () => import("./vocabularyService");

const response = {
  hierarchy: [
    {
      ordinal: 1,
      code: "1",
      name: "NATURAL SCIENCES",
      children: [
        { ordinal: 1, code: "1.1", name: "MATHEMATICS" },
        { ordinal: 2, code: "1.2", name: "COMPUTER AND INFORMATION SCIENCES" },
      ],
    },
  ],
};

describe("processFieldsOfScience", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses the vocabulary name as the option value, keeping code and readable label", async () => {
    const { processFieldsOfScience } = await load();

    expect(processFieldsOfScience(response)).toEqual([
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
    ]);
  });

  it("exposes the processed vocabulary once it has been loaded", async () => {
    const { cachedFieldsOfScience, processFieldsOfScience } = await load();

    expect(cachedFieldsOfScience()).toBeNull();
    const categories = processFieldsOfScience(response);
    expect(cachedFieldsOfScience()).toBe(categories);
  });
});
