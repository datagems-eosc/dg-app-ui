import assert from "node:assert/strict";
import test from "node:test";

interface Dataset {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
  datasets?: Dataset[];
  datasetIds?: string[];
}

const extractDatasetIds = (collection: Collection): string[] => {
  let datasetIds: string[] = [];

  if (
    "datasets" in collection &&
    collection.datasets &&
    collection.datasets.length > 0
  ) {
    datasetIds = collection.datasets
      .map((dataset) => dataset.id)
      .filter((id): id is string => !!id);
  } else if (collection.datasetIds && collection.datasetIds.length > 0) {
    datasetIds = collection.datasetIds.filter((id): id is string => !!id);
  }

  return datasetIds;
};

test("extractDatasetIds - filters out undefined from datasets array", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasets: [
      { id: "dataset-1", name: "Dataset 1" },
      { id: undefined as any, name: "Dataset 2" },
      { id: "dataset-3", name: "Dataset 3" },
    ],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, ["dataset-1", "dataset-3"]);
});

test("extractDatasetIds - filters out null from datasets array", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasets: [
      { id: "dataset-1", name: "Dataset 1" },
      { id: null as any, name: "Dataset 2" },
      { id: "dataset-3", name: "Dataset 3" },
    ],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, ["dataset-1", "dataset-3"]);
});

test("extractDatasetIds - filters out empty strings from datasets array", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasets: [
      { id: "dataset-1", name: "Dataset 1" },
      { id: "", name: "Dataset 2" },
      { id: "dataset-3", name: "Dataset 3" },
    ],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, ["dataset-1", "dataset-3"]);
});

test("extractDatasetIds - handles all valid dataset IDs", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasets: [
      { id: "dataset-1", name: "Dataset 1" },
      { id: "dataset-2", name: "Dataset 2" },
      { id: "dataset-3", name: "Dataset 3" },
    ],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, ["dataset-1", "dataset-2", "dataset-3"]);
});

test("extractDatasetIds - filters out undefined from datasetIds array", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasetIds: ["dataset-1", undefined as any, "dataset-3"],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, ["dataset-1", "dataset-3"]);
});

test("extractDatasetIds - filters out null from datasetIds array", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasetIds: ["dataset-1", null as any, "dataset-3"],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, ["dataset-1", "dataset-3"]);
});

test("extractDatasetIds - returns empty array for collection without datasets", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, []);
});

test("extractDatasetIds - returns empty array for collection with empty datasets", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasets: [],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, []);
});

test("extractDatasetIds - handles collection with all invalid dataset IDs", () => {
  const collection: Collection = {
    id: "test-collection",
    name: "Test Collection",
    datasets: [
      { id: undefined as any, name: "Dataset 1" },
      { id: null as any, name: "Dataset 2" },
      { id: "", name: "Dataset 3" },
    ],
  };

  const result = extractDatasetIds(collection);

  assert.deepEqual(result, []);
});
