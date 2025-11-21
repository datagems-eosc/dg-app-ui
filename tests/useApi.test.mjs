import assert from "node:assert/strict";
import test from "node:test";

test("Collection API error messages are correctly defined", () => {
  const expectedErrors = {
    FETCH_USER_COLLECTIONS: "Failed to fetch user collections",
    CREATE_COLLECTION: "Failed to create collection",
    ADD_DATASET_TO_COLLECTION: "Failed to add dataset to collection",
    REMOVE_DATASET_FROM_COLLECTION: "Failed to remove dataset from collection",
    DELETE_COLLECTION: "Failed to delete collection",
    FETCH_COLLECTIONS: "Failed to fetch collections",
  };

  assert.equal(
    expectedErrors.FETCH_USER_COLLECTIONS,
    "Failed to fetch user collections",
  );
  assert.equal(expectedErrors.CREATE_COLLECTION, "Failed to create collection");
  assert.equal(
    expectedErrors.ADD_DATASET_TO_COLLECTION,
    "Failed to add dataset to collection",
  );
  assert.equal(
    expectedErrors.REMOVE_DATASET_FROM_COLLECTION,
    "Failed to remove dataset from collection",
  );
  assert.equal(expectedErrors.DELETE_COLLECTION, "Failed to delete collection");
  assert.equal(expectedErrors.FETCH_COLLECTIONS, "Failed to fetch collections");
});
