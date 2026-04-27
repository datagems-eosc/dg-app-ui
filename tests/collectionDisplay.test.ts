import assert from "node:assert/strict";
import test from "node:test";
import {
  getDisplayCategory,
  getDisplayCollectionName,
  getDisplayCollections,
} from "../src/config/collectionConstants";

test("getDisplayCollections - filters out custom collections", () => {
  const collections = [
    { id: "1", name: "Language" },
    { id: "2", name: "Custom" },
    { id: "3", name: "Weather" },
    { id: "4", name: "Custom Collection" },
  ];
  const result = getDisplayCollections(collections);
  assert.deepEqual(
    result.map((c) => c.name),
    ["Language", "Weather"],
  );
});

test("getDisplayCollections - limits to maxCount", () => {
  const collections = [
    { id: "1", name: "Language" },
    { id: "2", name: "Weather" },
    { id: "3", name: "Math" },
    { id: "4", name: "Biology" },
    { id: "5", name: "Physics" },
    { id: "6", name: "Chemistry" },
  ];
  const result = getDisplayCollections(collections, 3);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((c) => c.name),
    ["Language", "Weather", "Math"],
  );
});

test("getDisplayCollections - filters Custom case insensitively", () => {
  const collections = [
    { id: "1", name: "CUSTOM" },
    { id: "2", name: "safsfasfasfaCustom" },
    { id: "3", name: "Language" },
  ];
  const result = getDisplayCollections(collections);
  assert.deepEqual(
    result.map((c) => c.name),
    ["Language"],
  );
});

test("getDisplayCollectionName - removes Collection suffix", () => {
  assert.equal(
    getDisplayCollectionName({ name: "Language Collection" }),
    "Language",
  );
});

test("getDisplayCollectionName - preserves name without suffix", () => {
  assert.equal(getDisplayCollectionName({ name: "Weather" }), "Weather");
});

test("getDisplayCategory - returns first non-custom collection", () => {
  const collections = [
    { id: "1", name: "Custom" },
    { id: "2", name: "Language" },
    { id: "3", name: "Weather" },
  ];
  assert.equal(getDisplayCategory(collections, "Math"), "Language");
});

test("getDisplayCategory - returns fallback when all custom", () => {
  const collections = [
    { id: "1", name: "Custom" },
    { id: "2", name: "Custom Collection" },
  ];
  assert.equal(getDisplayCategory(collections, "Math"), "Math");
});

test("getDisplayCategory - returns fallback when empty", () => {
  assert.equal(getDisplayCategory([], "Weather"), "Weather");
  assert.equal(getDisplayCategory(undefined, "Math"), "Math");
});
