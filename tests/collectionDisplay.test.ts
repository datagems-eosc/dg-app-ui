import assert from "node:assert/strict";
import test from "node:test";
import {
  getDisplayCollectionLabel,
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

test("getDisplayCollections - drops blank names before limiting", () => {
  const collections = [
    { id: "1", name: "" },
    { id: "2", name: "   " },
    { id: "3", name: " Collection" },
    { id: "4", name: "Meteo" },
    { id: "5", name: "Math" },
  ];
  const result = getDisplayCollections(collections, 1);
  assert.deepEqual(
    result.map((c) => c.name),
    ["Meteo"],
  );
});

const labelCases: Array<[string, { name: string }[] | undefined, string]> = [
  [
    "first non-custom collection",
    [{ name: "Custom" }, { name: "Language" }, { name: "Weather" }],
    "Language",
  ],
  ["genuine Math is kept", [{ name: "Math" }], "Math"],
  ["suffix is removed", [{ name: "Meteo Collection" }], "Meteo"],
  ["missing collections", undefined, ""],
  ["empty collections", [], ""],
  ["only blank names", [{ name: "" }, { name: "  " }], ""],
  [
    "all filtered as custom",
    [{ name: "Custom" }, { name: "Custom Collection" }],
    "",
  ],
];

for (const [label, collections, expected] of labelCases) {
  test(`getDisplayCollectionLabel - ${label}`, () => {
    assert.equal(getDisplayCollectionLabel(collections), expected);
  });
}
