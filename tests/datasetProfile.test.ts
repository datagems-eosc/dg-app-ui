import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFilePreviews,
  buildFileTree,
  mapFieldStatistics,
  parseProfileRaw,
  transposeSamplesToRows,
} from "../src/lib/datasetProfile";

// Trimmed but structurally-real MOMA Croissant profile (per dg-dataset-profiler
// docs/profile-examples-moma.md): distribution = files, recordSet.field = columns
// with per-column `sample` arrays and `dg:` statistics.
const PROFILE = {
  distribution: [
    {
      "@type": "cr:FileObject",
      "@id": "f1",
      name: "weather.csv",
      contentSize: "65040 B",
      encodingFormat: "text/csv",
    },
    {
      "@type": "cr:FileObject",
      "@id": "f2",
      name: "notes.pdf",
      encodingFormat: "application/pdf",
    },
    {
      "@type": "cr:FileObject",
      "@id": "f3",
      name: "meta.json",
      encodingFormat: "application/json",
    },
  ],
  recordSet: [
    {
      "@type": "cr:RecordSet",
      "@id": "rs1",
      name: "weather",
      field: [
        {
          "@type": "cr:Field",
          "@id": "c1",
          name: "station_id",
          description: "ID",
          dataType: "sc:Text",
          source: {
            fileObject: { "@id": "f1" },
            extract: { column: "station_id" },
          },
          sample: ["A", "B", "C"],
          statistics: {
            rowCount: 1447,
            missingCount: 0,
            missingPercentage: 0,
            uniqueCount: 3,
          },
        },
        {
          "@type": "cr:Field",
          "@id": "c2",
          name: "temperature",
          description: "Air temperature",
          dataType: "sc:Float",
          source: {
            fileObject: { "@id": "f1" },
            extract: { column: "temperature" },
          },
          sample: [12.5, 13, 11.2],
          statistics: {
            rowCount: 1447,
            mean: 12.2,
            median: 12.5,
            standardDeviation: 0.9,
            min: 11.2,
            max: 13,
            missingCount: 333,
            missingPercentage: 23,
            uniqueCount: 100,
            histogram:
              '[{"binRange":[11,12],"count":5},{"binRange":[12,13],"count":7}]',
          },
        },
      ],
    },
  ],
};

test("parseProfileRaw accepts a JSON string or object and rejects junk", () => {
  assert.equal(parseProfileRaw(null), null);
  assert.equal(parseProfileRaw("not json"), null);
  assert.deepEqual(parseProfileRaw('{"recordSet":[]}'), { recordSet: [] });
  const obj = { recordSet: [] };
  assert.equal(parseProfileRaw(obj), obj);
});

test("transposeSamplesToRows converts column-major samples into row objects", () => {
  const rows = transposeSamplesToRows([
    { "@id": "c1", sample: [1, 2, 3] },
    { "@id": "c2", sample: ["x", "y", "z"] },
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows[0].cells.map((c) => [c.columnId, c.value]),
    [
      ["c1", 1],
      ["c2", "x"],
    ],
  );
});

test("transposeSamplesToRows caps rows at the given limit", () => {
  const fields = [
    { "@id": "c1", sample: Array.from({ length: 250 }, (_, i) => i) },
  ];
  assert.equal(transposeSamplesToRows(fields, 100).length, 100);
});

test("mapFieldStatistics maps dg fields and parses the histogram string", () => {
  const stats = mapFieldStatistics(PROFILE.recordSet[0].field[1]);
  assert.equal(stats.columnId, "c2");
  assert.equal(stats.mean, 12.2);
  assert.equal(stats.stdDev, 0.9);
  assert.equal(stats.nullCount, 333);
  assert.equal(stats.missingPercentage, 23);
  assert.equal(stats.uniqueValues, 100);
  assert.deepEqual(stats.distribution, [5, 7]);
});

test("buildFilePreviews builds a tabular preview for a recordSet file", () => {
  const csv = buildFilePreviews(PROFILE).find((p) => p.id === "f1");
  assert.ok(csv);
  assert.equal(csv.mimeType, "text/csv");
  assert.equal(csv.data.type, "tabular");
  if (csv.data.type !== "tabular") return;
  assert.deepEqual(
    csv.data.columns.map((c) => c.name),
    ["station_id", "temperature"],
  );
  assert.equal(csv.data.columns[0].type, "categorical");
  assert.equal(csv.data.columns[1].type, "numeric");
  assert.equal(csv.data.rows.length, 3);
  assert.equal(csv.data.totalRows, 1447);
  // total missing cells / total cells = (0 + 333) / (1447 * 2) * 100
  assert.ok(
    Math.abs((csv.data.totalMissingPercentage ?? 0) - 11.5065) < 0.01,
    `expected ~11.51, got ${csv.data.totalMissingPercentage}`,
  );
  assert.equal(csv.data.statistics.length, 2);
});

const TREE_PROFILE = {
  distribution: [
    {
      "@type": "cr:FileObject",
      "@id": "root.csv",
      name: "root.csv",
      encodingFormat: "text/csv",
    },
    { "@type": "cr:FileSet", "@id": "folderA", name: "PDFs" },
    {
      "@type": "cr:FileObject",
      "@id": "a.pdf",
      name: "a.pdf",
      encodingFormat: "application/pdf",
      containedIn: { "@id": "folderA" },
    },
    {
      "@type": "cr:FileObject",
      "@id": "b.pdf",
      name: "b.pdf",
      encodingFormat: "application/pdf",
      containedIn: { "@id": "folderA" },
    },
  ],
};

test("buildFileTree nests FileObjects under their containedIn FileSet", () => {
  const tree = buildFileTree(TREE_PROFILE);
  assert.equal(tree.length, 2);

  const folder = tree.find((node) => node.id === "folderA");
  assert.ok(folder);
  assert.equal(folder.kind, "folder");
  assert.deepEqual(
    folder.children?.map((child) => child.id),
    ["a.pdf", "b.pdf"],
  );

  const rootFile = tree.find((node) => node.id === "root.csv");
  assert.equal(rootFile?.kind, "file");
  assert.equal(rootFile?.mimeType, "text/csv");
});

test("buildFilePreviews skips FileSets — folders are not previewable", () => {
  const previews = buildFilePreviews(TREE_PROFILE);
  assert.deepEqual(previews.map((p) => p.id).sort(), [
    "a.pdf",
    "b.pdf",
    "root.csv",
  ]);
});

test("buildFilePreviews classifies pdf and json files by mime type", () => {
  const previews = buildFilePreviews(PROFILE);
  assert.equal(previews.find((p) => p.id === "f2")?.data.type, "pdf");
  assert.equal(previews.find((p) => p.id === "f3")?.data.type, "json");
});
