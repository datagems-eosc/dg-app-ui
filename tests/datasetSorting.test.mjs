import assert from "node:assert/strict";
import test from "node:test";
import { sortDatasetsWithSecondaryRules } from "../src/lib/datasetSorting.ts";

const createMockDataset = (overrides) => ({
  id: "1",
  title: "Test Dataset",
  category: "Math",
  access: "Open Access",
  description: "Test description",
  size: "1 MB",
  lastUpdated: "2024-01-01",
  tags: [],
  ...overrides,
});

test("sorts by name A-Z when names are different", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Zebra" }),
    createMockDataset({ id: "2", title: "Alpha" }),
    createMockDataset({ id: "3", title: "Beta" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "Alpha");
  assert.equal(result[1].title, "Beta");
  assert.equal(result[2].title, "Zebra");
});

test("uses newest datePublished as secondary when names are identical", () => {
  const datasets = [
    createMockDataset({
      id: "1",
      title: "Same Name",
      datePublished: "2023-01-15",
    }),
    createMockDataset({
      id: "2",
      title: "Same Name",
      datePublished: "2024-06-20",
    }),
    createMockDataset({
      id: "3",
      title: "Same Name",
      datePublished: "2022-12-01",
    }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].id, "2");
  assert.equal(result[1].id, "1");
  assert.equal(result[2].id, "3");
});

test("sorts by date newest to oldest", () => {
  const datasets = [
    createMockDataset({
      id: "1",
      title: "A",
      datePublished: "2023-01-15",
    }),
    createMockDataset({
      id: "2",
      title: "B",
      datePublished: "2024-06-20",
    }),
    createMockDataset({
      id: "3",
      title: "C",
      datePublished: "2022-12-01",
    }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "datePublished-desc");

  assert.equal(result[0].id, "2");
  assert.equal(result[1].id, "1");
  assert.equal(result[2].id, "3");
});

test("uses name A-Z as secondary when dates are identical", () => {
  const datasets = [
    createMockDataset({
      id: "1",
      title: "Zebra Dataset",
      datePublished: "2024-01-15",
    }),
    createMockDataset({
      id: "2",
      title: "Alpha Dataset",
      datePublished: "2024-01-15",
    }),
    createMockDataset({
      id: "3",
      title: "Beta Dataset",
      datePublished: "2024-01-15",
    }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "datePublished-desc");

  assert.equal(result[0].title, "Alpha Dataset");
  assert.equal(result[1].title, "Beta Dataset");
  assert.equal(result[2].title, "Zebra Dataset");
});

test("sorts by size smallest to largest", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "A", size: "5 GB" }),
    createMockDataset({ id: "2", title: "B", size: "1 MB" }),
    createMockDataset({ id: "3", title: "C", size: "500 KB" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "size-asc");

  assert.equal(result[0].id, "3");
  assert.equal(result[1].id, "2");
  assert.equal(result[2].id, "1");
});

test("uses name A-Z as secondary when sizes are identical", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Zebra", size: "2.4 GB" }),
    createMockDataset({ id: "2", title: "Alpha", size: "2.4 GB" }),
    createMockDataset({ id: "3", title: "Beta", size: "2.4 GB" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "size-asc");

  assert.equal(result[0].title, "Alpha");
  assert.equal(result[1].title, "Beta");
  assert.equal(result[2].title, "Zebra");
});

test("does not mutate original array", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "C" }),
    createMockDataset({ id: "2", title: "A" }),
    createMockDataset({ id: "3", title: "B" }),
  ];
  const originalIds = datasets.map((d) => d.id);

  sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.deepEqual(
    datasets.map((d) => d.id),
    originalIds,
  );
});
