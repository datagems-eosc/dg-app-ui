import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFilePreviews,
  buildFileTree,
  parseProfileRaw,
} from "../src/lib/datasetProfile";

// Mirrors the REAL gateway profileRaw: a { nodes, edges } graph
// (per a live GET /api/dataset/{id}). Nodes carry labels + properties;
// edges are typed relationships {from, to, labels:[type]}.
const GRAPH = {
  nodes: [
    {
      id: "ds",
      labels: ["sc:Dataset"],
      properties: { name: "zoo_tierarten_2024", status: "ready" },
    },
    {
      id: "file1",
      labels: ["CSV", "Data", "cr:FileObject"],
      properties: {
        name: "zoo-2024.csv",
        encodingFormat: "text/csv",
        contentSize: "2407043 B",
      },
    },
    {
      id: "col1",
      labels: ["Column", "cr:Field"],
      properties: {
        name: "Kategorie",
        dataType: "sc:Text",
        description: "category",
        sample: ["Amphibien", "Fische"],
      },
    },
    {
      id: "col2",
      labels: ["Column", "cr:Field"],
      properties: { name: "Anzahl", dataType: "sc:Integer", description: "" },
    },
    {
      id: "rs",
      labels: ["cr:RecordSet"],
      properties: {
        name: "zoo-2024",
        examples: JSON.stringify({
          Kategorie: ["Amphibien", "Fische", "Voegel"],
          Anzahl: [3, 5, 7],
        }),
      },
    },
    {
      id: "stat1",
      labels: ["Statistics", "dg:ColumnStatistics"],
      properties: {
        rowCount: 192,
        missingCount: 0,
        missingPercentage: 0,
        uniqueCount: 190,
      },
    },
    {
      id: "stat2",
      labels: ["Statistics", "dg:ColumnStatistics"],
      properties: {
        rowCount: 192,
        missingCount: 12,
        missingPercentage: 6.25,
        uniqueCount: 50,
        mean: 4.2,
        median: 4,
        standardDeviation: 1.1,
        min: 1,
        max: 9,
        histogram:
          '[{"binRange":[1,5],"count":100},{"binRange":[5,9],"count":80}]',
      },
    },
  ],
  edges: [
    { from: "ds", to: "file1", labels: ["distribution"] },
    { from: "ds", to: "rs", labels: ["recordSet"] },
    { from: "rs", to: "col1", labels: ["field"] },
    { from: "rs", to: "col2", labels: ["field"] },
    { from: "col1", to: "file1", labels: ["source/fileObject"] },
    { from: "col2", to: "file1", labels: ["source/fileObject"] },
    { from: "col1", to: "stat1", labels: ["statistics"] },
    { from: "col2", to: "stat2", labels: ["statistics"] },
  ],
};

test("parseProfileRaw accepts a {nodes} graph (object or JSON string), rejects junk", () => {
  assert.equal(parseProfileRaw(null), null);
  assert.equal(parseProfileRaw("nope"), null);
  assert.equal(parseProfileRaw({ foo: 1 }), null);
  assert.ok(parseProfileRaw(GRAPH));
  assert.ok(parseProfileRaw(JSON.stringify(GRAPH)));
});

test("buildFilePreviews builds a tabular preview for a CSV file from the graph", () => {
  const file = buildFilePreviews(GRAPH).find((p) => p.id === "file1");
  assert.ok(file);
  assert.equal(file.mimeType, "text/csv");
  assert.equal(file.data.type, "tabular");
  if (file.data.type !== "tabular") return;

  assert.deepEqual(
    file.data.columns.map((c) => c.name),
    ["Kategorie", "Anzahl"],
  );
  assert.equal(file.data.columns[0].type, "categorical");
  assert.equal(file.data.columns[1].type, "numeric");
  assert.equal(file.data.columns[0].description, "category");

  // rows come from the RecordSet examples (column-major -> row-major)
  assert.equal(file.data.rows.length, 3);
  assert.deepEqual(
    file.data.rows[0].cells.map((cell) => cell.value),
    ["Amphibien", 3],
  );

  assert.equal(file.data.totalRows, 192);
  assert.equal(file.data.statistics.length, 2);
  // total missing cells / total cells = (0 + 12) / (192 * 2) * 100
  assert.ok(
    Math.abs((file.data.totalMissingPercentage ?? 0) - 3.125) < 0.001,
    `got ${file.data.totalMissingPercentage}`,
  );
});

test("buildFilePreviews maps numeric column statistics incl. histogram", () => {
  const file = buildFilePreviews(GRAPH).find((p) => p.id === "file1");
  if (file?.data.type !== "tabular") throw new Error("expected tabular");
  const anzahl = file.data.statistics.find((s) => s.columnId === "col2");
  assert.ok(anzahl);
  assert.equal(anzahl.mean, 4.2);
  assert.equal(anzahl.stdDev, 1.1);
  assert.equal(anzahl.min, 1);
  assert.equal(anzahl.max, 9);
  assert.equal(anzahl.nullCount, 12);
  assert.equal(anzahl.uniqueValues, 50);
  assert.deepEqual(anzahl.distribution, [100, 80]);
});

test("buildFileTree lists files from the graph", () => {
  const tree = buildFileTree(GRAPH);
  const file = tree.find((n) => n.id === "file1");
  assert.ok(file);
  assert.equal(file.kind, "file");
  assert.equal(file.mimeType, "text/csv");
});

test("buildFilePreviews classifies pdf/json files with no columns by mime", () => {
  const graph = {
    nodes: [
      { id: "ds", labels: ["sc:Dataset"], properties: { name: "d" } },
      {
        id: "p",
        labels: ["cr:FileObject"],
        properties: { name: "doc.pdf", encodingFormat: "application/pdf" },
      },
      {
        id: "j",
        labels: ["cr:FileObject"],
        properties: { name: "meta.json", encodingFormat: "application/json" },
      },
    ],
    edges: [
      { from: "ds", to: "p", labels: ["distribution"] },
      { from: "ds", to: "j", labels: ["distribution"] },
    ],
  };
  const previews = buildFilePreviews(graph);
  assert.equal(previews.find((p) => p.id === "p")?.data.type, "pdf");
  assert.equal(previews.find((p) => p.id === "j")?.data.type, "json");
});
