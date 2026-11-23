import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedFieldsOfScience,
  clearVocabularyCache,
  loadFieldsOfScience,
  processFieldsOfScience,
} from "./vocabularyService";

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

const otherResponse = {
  hierarchy: [
    {
      ordinal: 2,
      code: "2",
      name: "ENGINEERING AND TECHNOLOGY",
      children: [{ ordinal: 5, code: "2.5", name: "MATERIALS ENGINEERING" }],
    },
  ],
};

beforeEach(() => {
  clearVocabularyCache();
});

describe("processFieldsOfScience", () => {
  it("keeps each field's vocabulary name, code and readable label", () => {
    expect(processFieldsOfScience(response)).toEqual([
      {
        name: "Natural sciences",
        code: "1",
        options: [
          { name: "MATHEMATICS", label: "Mathematics", code: "1.1" },
          {
            name: "COMPUTER AND INFORMATION SCIENCES",
            label: "Computer and information sciences",
            code: "1.2",
          },
        ],
      },
    ]);
  });

  it("converts the data it is given on every call", () => {
    processFieldsOfScience(response);

    expect(processFieldsOfScience(otherResponse)[0].code).toBe("2");
  });
});

describe("loadFieldsOfScience", () => {
  it("requests the vocabulary once for every caller", async () => {
    const request = vi.fn().mockResolvedValue(response);

    const [first, second] = await Promise.all([
      loadFieldsOfScience(request),
      loadFieldsOfScience(request),
    ]);
    const third = await loadFieldsOfScience(request);

    expect(request).toHaveBeenCalledTimes(1);
    expect(first[0].code).toBe("1");
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("exposes the loaded vocabulary to synchronous readers", async () => {
    expect(cachedFieldsOfScience()).toBeNull();

    const categories = await loadFieldsOfScience(
      vi.fn().mockResolvedValue(response),
    );

    expect(cachedFieldsOfScience()).toBe(categories);
  });

  it("asks again after a failed request", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response);

    await expect(loadFieldsOfScience(request)).rejects.toThrow("offline");
    expect(cachedFieldsOfScience()).toBeNull();
    const categories = await loadFieldsOfScience(request);

    expect(request).toHaveBeenCalledTimes(2);
    expect(categories[0].code).toBe("1");
  });

  it("does not keep a vocabulary that arrives after the cache was cleared", async () => {
    let answer!: (data: unknown) => void;
    const pending = loadFieldsOfScience(
      () => new Promise((resolve) => (answer = resolve)),
    );

    clearVocabularyCache();
    answer(response);
    await pending;

    expect(cachedFieldsOfScience()).toBeNull();
  });

  it("asks again after a response with no usable vocabulary", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ hierarchy: [] })
      .mockResolvedValueOnce(response);

    expect(await loadFieldsOfScience(request)).toEqual([]);
    expect(cachedFieldsOfScience()).toBeNull();
    const categories = await loadFieldsOfScience(request);

    expect(request).toHaveBeenCalledTimes(2);
    expect(categories[0].code).toBe("1");
  });
});
