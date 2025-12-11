import assert from "node:assert/strict";
import test from "node:test";
import { sortDatasetsWithSecondaryRules } from "../src/lib/datasetSorting";

const createMockDataset = (overrides: any) => ({
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

test("sorts Oasa correctly in A-Z order before Z", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Zebra" }),
    createMockDataset({ id: "2", title: "Oasa" }),
    createMockDataset({ id: "3", title: "Alpha" }),
    createMockDataset({ id: "4", title: "Beta" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "Alpha");
  assert.equal(result[1].title, "Beta");
  assert.equal(result[2].title, "Oasa");
  assert.equal(result[3].title, "Zebra");
});

test("sorts Oasa correctly in Z-A order after Z", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Alpha" }),
    createMockDataset({ id: "2", title: "Oasa" }),
    createMockDataset({ id: "3", title: "Zebra" }),
    createMockDataset({ id: "4", title: "Beta" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-desc");

  assert.equal(result[0].title, "Zebra");
  assert.equal(result[1].title, "Oasa");
  assert.equal(result[2].title, "Beta");
  assert.equal(result[3].title, "Alpha");
});

test("sorts alphabetically A-Z with various letters", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Zebra" }),
    createMockDataset({ id: "2", title: "Alpha" }),
    createMockDataset({ id: "3", title: "Mike" }),
    createMockDataset({ id: "4", title: "Beta" }),
    createMockDataset({ id: "5", title: "Charlie" }),
    createMockDataset({ id: "6", title: "Delta" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "Alpha");
  assert.equal(result[1].title, "Beta");
  assert.equal(result[2].title, "Charlie");
  assert.equal(result[3].title, "Delta");
  assert.equal(result[4].title, "Mike");
  assert.equal(result[5].title, "Zebra");
});

test("sorts alphabetically Z-A with various letters", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Alpha" }),
    createMockDataset({ id: "2", title: "Mike" }),
    createMockDataset({ id: "3", title: "Zebra" }),
    createMockDataset({ id: "4", title: "Beta" }),
    createMockDataset({ id: "5", title: "Charlie" }),
    createMockDataset({ id: "6", title: "Delta" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-desc");

  assert.equal(result[0].title, "Zebra");
  assert.equal(result[1].title, "Mike");
  assert.equal(result[2].title, "Delta");
  assert.equal(result[3].title, "Charlie");
  assert.equal(result[4].title, "Beta");
  assert.equal(result[5].title, "Alpha");
});

test("sorts correctly with mixed case letters", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "zebra" }),
    createMockDataset({ id: "2", title: "ALPHA" }),
    createMockDataset({ id: "3", title: "Beta" }),
    createMockDataset({ id: "4", title: "charlie" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "ALPHA");
  assert.equal(result[1].title, "Beta");
  assert.equal(result[2].title, "charlie");
  assert.equal(result[3].title, "zebra");
});

test("sorts correctly with names containing numbers", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Dataset 10" }),
    createMockDataset({ id: "2", title: "Dataset 2" }),
    createMockDataset({ id: "3", title: "Dataset 1" }),
    createMockDataset({ id: "4", title: "Dataset 20" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "Dataset 1");
  assert.equal(result[1].title, "Dataset 2");
  assert.equal(result[2].title, "Dataset 10");
  assert.equal(result[3].title, "Dataset 20");
});

test("sorts correctly with names containing whitespace", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "  Dataset C  " }),
    createMockDataset({ id: "2", title: "Dataset A" }),
    createMockDataset({ id: "3", title: "  Dataset B  " }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "Dataset A");
  assert.equal(result[1].title, "  Dataset B  ");
  assert.equal(result[2].title, "  Dataset C  ");
});

test("sorts correctly with empty titles", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Zebra" }),
    createMockDataset({ id: "2", title: "" }),
    createMockDataset({ id: "3", title: "Alpha" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "");
  assert.equal(result[1].title, "Alpha");
  assert.equal(result[2].title, "Zebra");
});

test("sorts correctly with special characters in names", () => {
  const datasets = [
    createMockDataset({ id: "1", title: "Dataset-Z" }),
    createMockDataset({ id: "2", title: "Dataset-A" }),
    createMockDataset({ id: "3", title: "Dataset_M" }),
    createMockDataset({ id: "4", title: "Dataset.B" }),
  ];

  const result = sortDatasetsWithSecondaryRules(datasets, "name-asc");

  assert.equal(result[0].title, "Dataset_M");
  assert.equal(result[1].title, "Dataset-A");
  assert.equal(result[2].title, "Dataset-Z");
  assert.equal(result[3].title, "Dataset.B");
});
