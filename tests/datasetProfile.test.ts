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
  assert.deepEqual(anzahl.distributionRanges, [
    [1, 5],
    [5, 9],
  ]);
});

test("keeps other statistics when a histogram contains an invalid bin count", () => {
  const graph = structuredClone(GRAPH);
  const properties = graph.nodes.find(
    (node) => node.id === "stat2",
  )?.properties;
  assert.ok(properties);
  properties.histogram =
    '[{"binRange":[1,5],"count":0},{"binRange":[5,9],"count":"80"}]';
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(data?.type === "tabular");
  const stats = data.statistics.find((stat) => stat.columnId === "col2");
  assert.equal(stats?.distribution, undefined);
  assert.equal(stats?.mean, 4.2);
});

test("binds the quality report through the selected RecordSet, independent of node order", () => {
  const graph = {
    nodes: [
      {
        id: "find",
        labels: ["dg:DataQualityError"],
        properties: {
          column: "Reported column",
          errorType: "consistency_error",
          description: "Inconsistent values",
          totalAffectedRows: 0,
          examples:
            '__json__:[{"row":1,"value":false},{"row":2,"value":0},{"row":3,"value":null}]',
        },
      },
      {
        id: "other",
        labels: ["dg:DataQuality"],
        properties: { summary: "Another report" },
      },
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "A real report" },
      },
      ...GRAPH.nodes,
    ],
    edges: [
      { from: "another-record-set", to: "other", labels: ["HAS_DATA_QUALITY"] },
      { from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] },
      { from: "report", to: "find", labels: ["HAS_ERROR"] },
      ...GRAPH.edges,
    ],
  };
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(data?.type === "tabular");
  assert.deepEqual(data.dataQuality, {
    status: "available",
    summary: "A real report",
    findings: [
      {
        id: "find",
        column: "Reported column",
        category: "consistency_error",
        description: "Inconsistent values",
        affectedRows: 0,
        examples: [
          { row: 1, value: false },
          { row: 2, value: 0 },
          { row: 3, value: null },
        ],
      },
    ],
  });
});

test("does not call a report clean when a finding edge has no target", () => {
  const graph = {
    nodes: [
      ...GRAPH.nodes,
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "Quality check" },
      },
    ],
    edges: [
      ...GRAPH.edges,
      { from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] },
      { from: "report", labels: ["HAS_ERROR"] },
    ],
  };
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(data?.type === "tabular");
  assert.deepEqual(data.dataQuality, { status: "invalid" });
});

test("does not attach a report shared by a RecordSet spanning two files", () => {
  const graph = {
    nodes: [
      ...GRAPH.nodes,
      {
        id: "file2",
        labels: ["cr:FileObject"],
        properties: { name: "other.csv" },
      },
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "Shared report" },
      },
    ],
    edges: GRAPH.edges
      .map((edge) =>
        edge.from === "col2" && edge.labels.includes("source/fileObject")
          ? { ...edge, to: "file2" }
          : edge,
      )
      .concat({ from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] }),
  };
  const reports = buildFilePreviews(graph).map(({ data }) =>
    data.type === "tabular" ? data.dataQuality.status : data.type,
  );
  assert.deepEqual(reports, ["invalid", "invalid"]);
});

test("rejects a report node claimed by two separate RecordSets", () => {
  const graph = {
    nodes: [
      ...GRAPH.nodes,
      {
        id: "file2",
        labels: ["cr:FileObject"],
        properties: { name: "other.csv" },
      },
      { id: "rs2", labels: ["cr:RecordSet"] },
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "Shared object" },
      },
    ],
    edges: GRAPH.edges
      .map((edge) => {
        if (edge.from === "rs" && edge.to === "col2")
          return { ...edge, from: "rs2" };
        if (edge.from === "col2" && edge.to === "file1")
          return { ...edge, to: "file2" };
        return edge;
      })
      .concat([
        { from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] },
        { from: "rs2", to: "report", labels: ["HAS_DATA_QUALITY"] },
      ]),
  };
  const reports = buildFilePreviews(graph).map(({ data }) =>
    data.type === "tabular" ? data.dataQuality.status : data.type,
  );
  assert.deepEqual(reports, ["invalid", "invalid"]);
});

test("a wrong-type field relationship cannot attach a report to a file", () => {
  const graph = {
    nodes: [
      ...GRAPH.nodes,
      { id: "fake-field", labels: ["cr:FileObject"] },
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "Wrong scope" },
      },
    ],
    edges: GRAPH.edges
      .filter((edge) => edge.from !== "rs")
      .concat([
        { from: "rs", to: "fake-field", labels: ["field"] },
        { from: "fake-field", to: "file1", labels: ["source/fileObject"] },
        { from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] },
      ]),
  };
  const file = buildFilePreviews(graph).find(({ id }) => id === "file1");
  assert.ok(file?.data.type === "tabular");
  assert.deepEqual(file.data.dataQuality, { status: "unavailable" });
});

test("does not show a clean report when a linked field endpoint is invalid", () => {
  const graph = {
    nodes: [
      ...GRAPH.nodes,
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "Mixed scope" },
      },
    ],
    edges: [
      ...GRAPH.edges,
      { from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] },
      { from: "rs", to: "file1", labels: ["field"] },
    ],
  };
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(data?.type === "tabular");
  assert.deepEqual(data.dataQuality, { status: "invalid" });
});

test("keeps a finding when its serialized examples are malformed", () => {
  const graph = {
    nodes: [
      ...GRAPH.nodes,
      {
        id: "report",
        labels: ["dg:DataQuality"],
        properties: { summary: "Quality check" },
      },
      {
        id: "finding",
        labels: ["dg:DataQualityError"],
        properties: {
          column: "Anzahl",
          description: "Unexpected value",
          errorType: "unknown_pattern",
          totalAffectedRows: 1,
          examples: '__json__:{"invalid":true}',
        },
      },
    ],
    edges: [
      ...GRAPH.edges,
      { from: "rs", to: "report", labels: ["HAS_DATA_QUALITY"] },
      { from: "report", to: "finding", labels: ["HAS_ERROR"] },
    ],
  };
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(
    data?.type === "tabular" && data.dataQuality.status === "available",
  );
  assert.equal(data.dataQuality.findings[0].affectedRows, 1);
  assert.equal(data.dataQuality.findings[0].examples, null);
  assert.equal(data.dataQuality.findings[0].category, "unknown_pattern");
});

test("keeps the row total but omits a missing percentage when a column count exceeds it", () => {
  const graph = structuredClone(GRAPH);
  const properties = graph.nodes.find(
    (node) => node.id === "stat2",
  )?.properties;
  assert.ok(properties);
  properties.missingCount = 193;
  properties.uniqueCount = 193;
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(data?.type === "tabular");
  assert.equal(data.totalRows, 192);
  assert.equal(data.totalMissingPercentage, undefined);
  assert.equal(
    data.statistics.find((stat) => stat.columnId === "col2")?.uniqueValues,
    undefined,
  );
});

test("rejects impossible percentages and standard deviation without losing valid partial statistics", () => {
  const graph = structuredClone(GRAPH);
  const properties = graph.nodes.find(
    (node) => node.id === "stat2",
  )?.properties;
  assert.ok(properties);
  Object.assign(properties, { missingPercentage: 103, standardDeviation: -2 });
  const data = buildFilePreviews(graph)[0]?.data;
  assert.ok(data?.type === "tabular");
  const metric = data.statistics.find((item) => item.columnId === "col2");
  assert.equal(metric?.missingPercentage, undefined);
  assert.equal(metric?.stdDev, undefined);
  assert.equal(metric?.median, 4);
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

test("does not invent full row counts from preview sample length", () => {
  const graph = structuredClone(GRAPH);
  for (const node of graph.nodes)
    if ("rowCount" in node.properties)
      delete (node.properties as Record<string, unknown>).rowCount;
  const preview = buildFilePreviews(graph).find(
    (entry) => entry.data.type === "tabular",
  );
  assert.ok(preview?.data.type === "tabular");
  assert.equal(preview.data.totalRows, undefined);
  assert.equal(preview.data.totalMissingPercentage, undefined);
});

test("treats non-finite statistics as unknown, preserving finite zero", () => {
  const graph = structuredClone(GRAPH);
  for (const node of graph.nodes) {
    if (node.id === "stat2")
      Object.assign(node.properties, {
        mean: Number.NaN,
        min: Number.NEGATIVE_INFINITY,
        uniqueCount: Number.POSITIVE_INFINITY,
        missingPercentage: 0,
      });
  }
  const preview = buildFilePreviews(graph).find(
    (entry) => entry.data.type === "tabular",
  );
  assert.ok(preview?.data.type === "tabular");
  const stat = preview.data.statistics.find((stat) => stat.columnId === "col2");
  assert.equal(stat?.mean, undefined);
  assert.equal(stat?.min, undefined);
  assert.equal(stat?.uniqueValues, undefined);
  assert.equal(stat?.missingPercentage, 0);
});
