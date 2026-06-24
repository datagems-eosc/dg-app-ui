import type {
  ColumnStatistics,
  FileColumn,
  FilePreviewDataUnion,
  FileRow,
} from "@/types/filePreview";

/**
 * The gateway returns `profileRaw` (MOMA profile) as a property graph:
 * `nodes` carry `labels` + `properties`, and `edges` are typed relationships
 * `{ from, to, labels: [type] }`. Verified against a live GET /api/dataset/{id}.
 *
 * Node labels: sc:Dataset, cr:FileObject (files), cr:Field (columns),
 * cr:RecordSet (holds `examples` = stringified column->values), and
 * dg:ColumnStatistics. Edge types: distribution (dataset->file),
 * recordSet (dataset->recordSet), field (recordSet->column),
 * source/fileObject (column->file), statistics (column->stats).
 */
interface GraphNode {
  id?: string;
  labels?: string[];
  properties?: Record<string, unknown>;
}

interface GraphEdge {
  from?: string;
  to?: string;
  labels?: string[];
}

export interface ProfileGraph {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export interface FilePreviewEntry {
  id: string; // FileObject node id — the fileObjectNodeId used for download
  name: string;
  mimeType?: string;
  data: FilePreviewDataUnion;
}

export interface ProfileTreeNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  mimeType?: string;
  children?: ProfileTreeNode[];
}

const LABEL_FILE = "cr:FileObject";
const LABEL_FIELD = "cr:Field";
const LABEL_RECORDSET = "cr:RecordSet";

const EDGE_FIELD = "field";
const EDGE_SOURCE = "source/fileObject";
const EDGE_STATISTICS = "statistics";

const NUMERIC_TYPES = new Set([
  "sc:Integer",
  "sc:Float",
  "sc:Number",
  "sc:Decimal",
  "sc:Long",
]);
const JSON_MIMES = new Set(["application/json", "application/x-ipynb+json"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProfileRaw(raw: unknown): ProfileGraph | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (isObject(value) && Array.isArray((value as ProfileGraph).nodes)) {
    return value as ProfileGraph;
  }
  return null;
}

function hasLabel(node: GraphNode, label: string): boolean {
  return Array.isArray(node.labels) && node.labels.includes(label);
}

function edgeType(edge: GraphEdge): string {
  return Array.isArray(edge.labels) && edge.labels.length > 0
    ? edge.labels[0]
    : "";
}

function mapColumnType(dataType: unknown): FileColumn["type"] {
  if (typeof dataType !== "string") return "categorical";
  if (NUMERIC_TYPES.has(dataType)) return "numeric";
  if (dataType === "sc:Boolean") return "boolean";
  if (dataType === "sc:Date" || dataType === "sc:DateTime") return "date";
  return "categorical";
}

function parseHistogram(histogram: unknown): number[] | undefined {
  if (typeof histogram !== "string") return undefined;
  try {
    const bins = JSON.parse(histogram);
    if (!Array.isArray(bins)) return undefined;
    return bins.map((bin) => {
      const count = (bin as { count?: unknown })?.count;
      return typeof count === "number" ? count : 0;
    });
  } catch {
    return undefined;
  }
}

function mapColumnStatistics(
  columnId: string,
  props: Record<string, unknown> | undefined,
): ColumnStatistics {
  const stat: ColumnStatistics = { columnId };
  if (!props) return stat;
  const num = (key: string) =>
    typeof props[key] === "number" ? (props[key] as number) : undefined;

  if (num("uniqueCount") !== undefined) stat.uniqueValues = num("uniqueCount");
  if (num("missingCount") !== undefined) stat.nullCount = num("missingCount");
  if (num("mean") !== undefined) stat.mean = num("mean");
  if (num("median") !== undefined) stat.median = num("median");
  if (num("standardDeviation") !== undefined) {
    stat.stdDev = num("standardDeviation");
  }
  if (num("missingPercentage") !== undefined) {
    stat.missingPercentage = num("missingPercentage");
  }
  if (
    props.min != null &&
    (typeof props.min === "number" || typeof props.min === "string")
  ) {
    stat.min = props.min;
  }
  if (
    props.max != null &&
    (typeof props.max === "number" || typeof props.max === "string")
  ) {
    stat.max = props.max;
  }
  const distribution = parseHistogram(props.histogram);
  if (distribution) stat.distribution = distribution;
  return stat;
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

interface GraphIndex {
  nodeById: Map<string, GraphNode>;
  targetsOf: (fromId: string, type: string) => string[];
}

function indexGraph(graph: ProfileGraph): GraphIndex {
  const nodeById = new Map<string, GraphNode>();
  for (const node of graph.nodes ?? []) {
    if (node.id) nodeById.set(node.id, node);
  }
  const edges = graph.edges ?? [];
  return {
    nodeById,
    targetsOf: (fromId, type) =>
      edges
        .filter((e) => e.from === fromId && edgeType(e) === type && e.to)
        .map((e) => e.to as string),
  };
}

function buildRows(
  recordSet: GraphNode | undefined,
  columns: GraphNode[],
): FileRow[] {
  const rawExamples = recordSet?.properties?.examples;
  if (typeof rawExamples !== "string") return [];
  let examples: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawExamples);
    if (!isObject(parsed)) return [];
    examples = parsed;
  } catch {
    return [];
  }

  const columnValues = columns.map((column) => {
    const name = String(column.properties?.name ?? "");
    const values = examples[name];
    return Array.isArray(values) ? values : [];
  });

  const rowCount = Math.min(
    100,
    columnValues.reduce((max, values) => Math.max(max, values.length), 0),
  );

  const rows: FileRow[] = [];
  for (let index = 0; index < rowCount; index++) {
    rows.push({
      id: String(index),
      cells: columns.map((column, columnIndex) => ({
        columnId: column.id ?? "",
        value: normalizeCell(columnValues[columnIndex][index]),
      })),
    });
  }
  return rows;
}

function buildTabular(
  file: GraphNode,
  columns: GraphNode[],
  recordSet: GraphNode | undefined,
  index: GraphIndex,
): FilePreviewDataUnion {
  const statsProps = (columnId: string) => {
    const statsId = index.targetsOf(columnId, EDGE_STATISTICS)[0];
    return statsId ? index.nodeById.get(statsId)?.properties : undefined;
  };

  const uiColumns: FileColumn[] = columns.map((column) => ({
    id: column.id ?? "",
    name: String(column.properties?.name ?? ""),
    type: mapColumnType(column.properties?.dataType),
    visible: true,
    description: (column.properties?.description as string) || undefined,
  }));

  const statistics = columns.map((column) =>
    mapColumnStatistics(column.id ?? "", statsProps(column.id ?? "")),
  );
  const rows = buildRows(recordSet, columns);

  const rowCounts = columns
    .map((column) => statsProps(column.id ?? "")?.rowCount)
    .filter((count): count is number => typeof count === "number");
  const totalRows = rowCounts.length > 0 ? rowCounts[0] : rows.length;

  const missingCounts = columns
    .map((column) => statsProps(column.id ?? "")?.missingCount)
    .filter((count): count is number => typeof count === "number");
  const totalCells = totalRows * columns.length;
  const totalMissingPercentage =
    missingCounts.length > 0 && totalCells > 0
      ? (missingCounts.reduce((sum, count) => sum + count, 0) / totalCells) *
        100
      : undefined;

  return {
    type: "tabular",
    filename: String(file.properties?.name ?? ""),
    fileSize: String(file.properties?.contentSize ?? ""),
    description: "",
    columns: uiColumns,
    rows,
    totalRows,
    totalMissingPercentage,
    statistics,
    dataQuality: [],
  };
}

/**
 * Converts the profile graph into one preview entry per file. Tabular content
 * (columns/rows/statistics) is derived from the graph; JSON text and PDF bytes
 * are fetched separately on node click (their `content`/`fileUrl` stay empty).
 */
export function buildFilePreviews(raw: unknown): FilePreviewEntry[] {
  const graph = parseProfileRaw(raw);
  if (!graph) return [];
  const index = indexGraph(graph);
  const nodes = graph.nodes ?? [];

  const recordSets = nodes.filter((node) => hasLabel(node, LABEL_RECORDSET));
  const files = nodes.filter((node) => hasLabel(node, LABEL_FILE));
  const entries: FilePreviewEntry[] = [];

  const fileOfColumn = (columnId: string) =>
    index.targetsOf(columnId, EDGE_SOURCE)[0];

  for (const file of files) {
    const fileId = file.id;
    if (!fileId) continue;
    const name = String(file.properties?.name ?? "");
    const mime =
      typeof file.properties?.encodingFormat === "string"
        ? (file.properties.encodingFormat as string)
        : undefined;

    const recordSet = recordSets.find((rs) =>
      index
        .targetsOf(rs.id ?? "", EDGE_FIELD)
        .some((columnId) => fileOfColumn(columnId) === fileId),
    );

    let columns: GraphNode[] = [];
    if (recordSet) {
      columns = index
        .targetsOf(recordSet.id ?? "", EDGE_FIELD)
        .map((columnId) => index.nodeById.get(columnId))
        .filter(
          (node): node is GraphNode =>
            !!node &&
            hasLabel(node, LABEL_FIELD) &&
            (fileOfColumn(node.id ?? "") === fileId ||
              fileOfColumn(node.id ?? "") === undefined),
        );
    } else {
      columns = nodes.filter(
        (node) =>
          hasLabel(node, LABEL_FIELD) && fileOfColumn(node.id ?? "") === fileId,
      );
    }

    let data: FilePreviewDataUnion;
    if (columns.length > 0) {
      data = buildTabular(file, columns, recordSet, index);
    } else if (mime === "application/pdf") {
      data = {
        type: "pdf",
        filename: name,
        fileSize: String(file.properties?.contentSize ?? ""),
        description: "",
        fileUrl: "",
        totalPages: 0,
      };
    } else if (mime && JSON_MIMES.has(mime)) {
      data = {
        type: "json",
        filename: name,
        fileSize: String(file.properties?.contentSize ?? ""),
        description: "",
        content: "",
      };
    } else {
      continue;
    }

    entries.push({ id: fileId, name, mimeType: mime, data });
  }

  return entries;
}

/**
 * Builds the file tree from the graph's FileObject nodes. (Datasets observed
 * so far are flat; folder grouping would require folder-typed nodes/edges,
 * not yet seen in the live graph.)
 */
export function buildFileTree(raw: unknown): ProfileTreeNode[] {
  const graph = parseProfileRaw(raw);
  if (!graph) return [];
  return (graph.nodes ?? [])
    .filter((node) => hasLabel(node, LABEL_FILE) && node.id)
    .map((node) => ({
      id: node.id as string,
      name: String(node.properties?.name ?? ""),
      kind: "file" as const,
      mimeType:
        typeof node.properties?.encodingFormat === "string"
          ? (node.properties.encodingFormat as string)
          : undefined,
    }));
}
