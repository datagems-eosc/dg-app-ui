import assert from "node:assert/strict";
import test from "node:test";
import {
  clearVocabularyCache,
  processFieldsOfScience,
  processLicenses,
} from "../src/lib/vocabularyService";

test("processFieldsOfScience returns hierarchical categories from array", () => {
  clearVocabularyCache();
  const input = [
    {
      ordinal: 1,
      code: "A",
      name: "Root",
      children: [{ ordinal: 2, code: "B", name: "Child" }],
    },
    {
      ordinal: 3,
      code: "C",
      name: "NoChildren",
      children: [],
    },
  ];
  const result = processFieldsOfScience(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Root");
  assert.equal(result[0].options[0].label, "Child");
});

test("processFieldsOfScience returns from hierarchy property", () => {
  clearVocabularyCache();
  const input = {
    hierarchy: [
      {
        ordinal: 1,
        code: "A",
        name: "Root",
        children: [{ ordinal: 2, code: "B", name: "Child" }],
      },
    ],
  };
  const result = processFieldsOfScience(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Root");
});

test("processFieldsOfScience returns cached result on second call", () => {
  clearVocabularyCache();
  const input = [
    {
      ordinal: 1,
      code: "A",
      name: "Root",
      children: [{ ordinal: 2, code: "B", name: "Child" }],
    },
  ];
  const first = processFieldsOfScience(input);
  const second = processFieldsOfScience([]); // Should return cached
  assert.deepEqual(second, first);
});

test("processFieldsOfScience returns [] on error", () => {
  clearVocabularyCache();
  const result = processFieldsOfScience(undefined as any);
  assert.deepEqual(result, []);
});

test("processLicenses handles direct array", () => {
  clearVocabularyCache();
  const input = [
    { code: "MIT", name: "MIT License", description: "MIT desc", url: "url1" },
    { code: "GPL", name: "GPL License", url: ["url2", "url3"] },
  ];
  const result = processLicenses(input);
  assert.equal(result.length, 2);
  assert.equal(result[0].value, "MIT");
  assert.equal(result[0].label, "MIT License");
  assert.equal(result[0].description, "MIT desc");
  assert.deepEqual(result[1].urls, ["url2", "url3"]);
});

test("processLicenses handles wrapped array property", () => {
  clearVocabularyCache();
  const input = {
    licenses: [
      { code: "MIT", name: "MIT License" },
      { code: "GPL", name: "GPL License" },
    ],
  };
  const result = processLicenses(input);
  assert.equal(result.length, 2);
  assert.equal(result[1].value, "GPL");
});

test("processLicenses handles object as map", () => {
  clearVocabularyCache();
  const input = { MIT: "MIT License", GPL: "GPL License" };
  const result = processLicenses(input);
  assert.equal(result.length, 2);
  assert.equal(result[0].value, "MIT");
  assert.equal(result[0].label, "MIT License");
});

test("processLicenses returns cached result on second call", () => {
  clearVocabularyCache();
  const input = [{ code: "MIT", name: "MIT License" }];
  const first = processLicenses(input);
  const second = processLicenses([]); // Should return cached
  assert.deepEqual(second, first);
});

test("processLicenses returns [] on error", () => {
  clearVocabularyCache();
  const result = processLicenses(undefined as any);
  assert.deepEqual(result, []);
});
