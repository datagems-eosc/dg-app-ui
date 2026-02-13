import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFilePreviewData,
  mockFilePreviewData,
} from "../src/data/mockFilePreview";

describe("getFilePreviewData", () => {
  it("returns tabular data for CSV file", () => {
    const data = getFilePreviewData("file1-csv");
    assert.ok(data !== null);
    assert.strictEqual(data?.type, "tabular");
    assert.strictEqual(data?.filename, "File1.csv");
    if (data && "columns" in data) {
      assert.ok(Array.isArray(data.columns));
      assert.ok(data.columns.length > 0);
    }
  });

  it("returns tabular data for Excel file", () => {
    const data = getFilePreviewData("file2-xlsx");
    assert.ok(data !== null);
    assert.strictEqual(data?.type, "tabular");
  });

  it("returns PDF data for PDF file", () => {
    const data = getFilePreviewData("file-pdf");
    assert.ok(data !== null);
    assert.strictEqual(data?.type, "pdf");
    if (data && "fileUrl" in data) {
      assert.ok(typeof data.fileUrl === "string");
      assert.ok(data.fileUrl.length > 0);
    }
    if (data && "totalPages" in data) {
      assert.strictEqual(data.totalPages, 15);
    }
  });

  it("returns JSON data for JSON file", () => {
    const data = getFilePreviewData("file-json");
    assert.ok(data !== null);
    assert.strictEqual(data?.type, "json");
    if (data && "content" in data) {
      assert.ok(typeof data.content === "string");
    }
  });

  it("returns null for unknown file id", () => {
    const data = getFilePreviewData("unknown-file");
    assert.strictEqual(data, null);
  });
});

describe("mockFilePreviewData", () => {
  it("includes PDF and JSON entries", () => {
    assert.ok("file-pdf" in mockFilePreviewData);
    assert.ok("file-json" in mockFilePreviewData);
  });
});
