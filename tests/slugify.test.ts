import assert from "node:assert/strict";
import test from "node:test";
import { slugify } from "../src/lib/slugify";

test("slugify - converts to lowercase", () => {
  assert.equal(slugify("My Dataset"), "my-dataset");
});

test("slugify - replaces spaces with hyphens", () => {
  assert.equal(slugify("hello world"), "hello-world");
});

test("slugify - removes special characters", () => {
  assert.equal(slugify("test@dataset!"), "testdataset");
});

test("slugify - handles empty string", () => {
  assert.equal(slugify(""), "");
});

test("slugify - trims whitespace", () => {
  assert.equal(slugify("  dataset  "), "dataset");
});
