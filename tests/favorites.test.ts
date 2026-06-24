import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFavoriteDatasetIds,
  mapFavoritesToDatasets,
  type UserFavorite,
} from "../src/lib/favorites";

const sample: UserFavorite[] = [
  { id: "fav1", dataset: { id: "d1", name: "Alpha" } },
  {
    id: "fav2",
    dataset: { id: "d2", name: "Beta", permissions: ["browsedataset"] },
  },
  { id: "fav3", dataset: null },
  { id: "fav4" },
  { id: "fav5", dataset: { name: "NoId" } },
];

test("extractFavoriteDatasetIds returns [] for empty or nullish input", () => {
  assert.deepEqual(extractFavoriteDatasetIds(undefined), []);
  assert.deepEqual(extractFavoriteDatasetIds(null), []);
  assert.deepEqual(extractFavoriteDatasetIds([]), []);
});

test("extractFavoriteDatasetIds returns only ids of favorites with a dataset id", () => {
  assert.deepEqual(extractFavoriteDatasetIds(sample), ["d1", "d2"]);
});

test("extractFavoriteDatasetIds de-duplicates repeated dataset ids", () => {
  const dupes: UserFavorite[] = [
    { dataset: { id: "d1", name: "Alpha" } },
    { dataset: { id: "d1", name: "Alpha again" } },
  ];
  assert.deepEqual(extractFavoriteDatasetIds(dupes), ["d1"]);
});

test("mapFavoritesToDatasets maps each valid favorite's dataset to the local shape", () => {
  const datasets = mapFavoritesToDatasets(sample);
  assert.equal(datasets.length, 2);
  assert.equal(datasets[0].id, "d1");
  assert.equal(datasets[0].title, "Alpha");
  assert.equal(datasets[1].id, "d2");
  assert.equal(datasets[1].access, "Open Access");
});

test("mapFavoritesToDatasets returns [] for empty or nullish input", () => {
  assert.deepEqual(mapFavoritesToDatasets(undefined), []);
  assert.deepEqual(mapFavoritesToDatasets([]), []);
});
