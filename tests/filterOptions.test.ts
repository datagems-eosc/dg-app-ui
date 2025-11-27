import assert from "node:assert/strict";
import test from "node:test";
import * as filterOptions from "../src/config/filterOptions";

test("ACCESS_OPTIONS contains open and restricted", () => {
  assert.deepEqual(filterOptions.ACCESS_OPTIONS, [
    { value: "open", label: "Open" },
    { value: "restricted", label: "Restricted" },
  ]);
});

test("SORTING_OPTIONS contains all expected values", () => {
  const values = filterOptions.SORTING_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, [
    "name-asc",
    "name-desc",
    "datePublished-asc",
    "datePublished-desc",
    "size-asc",
    "size-desc",
  ]);
});

test("getDefaultFilters returns correct default state", () => {
  const def = filterOptions.getDefaultFilters();
  assert.deepEqual(def, {
    access: "",
    creationYear: { start: "", end: "" },
    datasetSize: { start: "", end: "" },
    fieldsOfScience: [],
    license: [],
  });
});

test("convertToBackendFilters omits empty fields", () => {
  const filters = {
    access: "",
    creationYear: { start: "", end: "" },
    datasetSize: { start: "", end: "" },
    fieldsOfScience: [],
    license: [],
  };
  const result = filterOptions.convertToBackendFilters(filters);
  assert.equal(result.access, undefined);
  assert.equal(result.publishedRange, undefined);
  assert.equal(result.sizeRange, undefined);
  assert.equal(result.fieldsOfScience, undefined);
  assert.equal(result.license, undefined);
});

test("VALIDATION_CONFIG year and size are correct", () => {
  assert.ok(filterOptions.VALIDATION_CONFIG.year.min <= 1900);
  assert.ok(
    filterOptions.VALIDATION_CONFIG.year.max >= new Date().getFullYear(),
  );
  assert.equal(filterOptions.VALIDATION_CONFIG.size.min, 0);
});
