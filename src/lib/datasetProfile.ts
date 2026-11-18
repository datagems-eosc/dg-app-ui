import type {
  ColumnStatistics,
  DataQualityExample,
  DataQualityFinding,
  DataQualityReport,
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
  if (!isObject(value) || !Array.isArray(value.nodes)) return null;
  // Keep identifiable nodes even when individual properties are unavailable.
  // Metadata aggregation must still know that their file coverage is partial.
  const nodes: GraphNode[] = value.nodes.flatMap((node: unknown) => {
    if (!isObject(node)) return [];
    return [
      {
        id: typeof node.id === "string" ? node.id : undefined,
        labels: Array.isArray(node.labels)
          ? node.labels.filter(
              (label): label is string => typeof label === "string",
            )
          : [],
        properties: isObject(node.properties) ? node.properties : undefined,
      },
    ];
  });
  const edges: GraphEdge[] = Array.isArray(value.edges)
    ? value.edges.flatMap((edge: unknown) => {
        if (!isObject(edge) || typeof edge.from !== "string") return [];
        return [
          {
            from: edge.from,
            to: typeof edge.to === "string" ? edge.to : undefined,
            labels: Array.isArray(edge.labels)
              ? edge.labels.filter(
                  (label): label is string => typeof label === "string",
                )
              : [],
          },
        ];
      })
    : [];
  return { nodes, edges };
}

function hasLabel(node: GraphNode, label: string): boolean {
  return Array.isArray(node.labels) && node.labels.includes(label);
}

function edgeType(edge: GraphEdge): string {
  return Array.isArray(edge.labels) && edge.labels.length > 0
    ? edge.labels[0]
    : "";
}

function mapColumnType(
  dataType: unknown,
  stats: ColumnStatistics,
): FileColumn["type"] {
  if (typeof dataType !== "string" || !dataType.trim()) {
    // Some profiled fields omit dataType even when the profiler computed numeric statistics.
    const numericValues = [
      stats.min,
      stats.max,
      stats.mean,
      stats.median,
      stats.stdDev,
      stats.percentile05,
      stats.percentile95,
    ];
    return numericValues.some((value) => typeof value === "number") ||
      stats.distribution?.length
      ? "numeric"
      : "categorical";
  }
  if (NUMERIC_TYPES.has(dataType)) return "numeric";
  if (dataType === "sc:Boolean") return "boolean";
  if (dataType === "sc:Date" || dataType === "sc:DateTime") return "date";
  return "categorical";
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseHistogram(
  histogram: unknown,
): Pick<ColumnStatistics, "distribution" | "distributionRanges"> {
  if (typeof histogram !== "string") return {};
  try {
    const bins = JSON.parse(histogram);
    if (!Array.isArray(bins) || bins.length === 0) return {};
    const counts = bins.map((bin: unknown) =>
      isObject(bin) ? bin.count : undefined,
    );
    if (!counts.every(isCount)) return {};
    if (bins.every((bin) => bin.binRange === undefined)) {
      return { distribution: counts };
    }
    const ranges: [number, number][] = [];
    for (const bin of bins) {
      const range: unknown = bin.binRange;
      if (!Array.isArray(range) || range.length !== 2) return {};
      const [min, max]: unknown[] = range;
      const previousMax = ranges.at(-1)?.[1];
      if (
        typeof min !== "number" ||
        !Number.isFinite(min) ||
        typeof max !== "number" ||
        !Number.isFinite(max) ||
        min >= max ||
        (previousMax !== undefined && min < previousMax)
      )
        return {};
      ranges.push([min, max]);
    }
    return { distribution: counts, distributionRanges: ranges };
  } catch {
    return {};
  }
}

function mapColumnStatistics(
  columnId: string,
  props: Record<string, unknown> | undefined,
): ColumnStatistics {
  const stat: ColumnStatistics = { columnId };
  if (!props) return stat;
  const num = (key: string) =>
    typeof props[key] === "number" && Number.isFinite(props[key])
      ? (props[key] as number)
      : undefined;
  const rowCount = props.rowCount;
  const missingCount = props.missingCount;

  if (
    isCount(props.uniqueCount) &&
    (!isCount(rowCount) || props.uniqueCount <= rowCount)
  ) {
    stat.uniqueValues = props.uniqueCount;
  }
  if (
    isCount(missingCount) &&
    (!isCount(rowCount) || missingCount <= rowCount)
  ) {
    stat.nullCount = missingCount;
  }
  stat.mean = num("mean");
  stat.median = num("median");
  stat.percentile05 = num("percentile05");
  stat.percentile95 = num("percentile95");
  const standardDeviation = num("standardDeviation");
  const missingPercentage = num("missingPercentage");
  if (standardDeviation !== undefined && standardDeviation >= 0)
    stat.stdDev = standardDeviation;
  if (
    missingPercentage !== undefined &&
    missingPercentage >= 0 &&
    missingPercentage <= 100
  ) {
    stat.missingPercentage = missingPercentage;
  }
  stat.min =
    typeof props.min === "string" ? props.min.trim() || undefined : num("min");
  stat.max =
    typeof props.max === "string" ? props.max.trim() || undefined : num("max");
  return { ...stat, ...parseHistogram(props.histogram) };
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
  duplicateNodeIds: Set<string>;
  targetsOf: (fromId: string, type: string) => string[];
  reportTargetsOf: (fromId: string, type: string) => (string | undefined)[];
  reportSourcesOf: (toId: string, type: string) => (string | undefined)[];
}

function indexGraph(graph: ProfileGraph): GraphIndex {
  const nodeById = new Map<string, GraphNode>();
  const duplicateNodeIds = new Set<string>();
  for (const node of graph.nodes ?? []) {
    if (!node.id) continue;
    if (nodeById.has(node.id)) duplicateNodeIds.add(node.id);
    nodeById.set(node.id, node);
  }
  const edges = graph.edges ?? [];
  return {
    nodeById,
    duplicateNodeIds,
    targetsOf: (fromId, type) =>
      edges
        .filter((e) => e.from === fromId && edgeType(e) === type && e.to)
        .map((e) => e.to as string),
    // Report states distinguish a missing edge from an edge with a missing endpoint.
    reportTargetsOf: (fromId, type) =>
      edges
        .filter((edge) => edge.from === fromId && edge.labels?.includes(type))
        .map((edge) => edge.to),
    reportSourcesOf: (toId, type) =>
      edges
        .filter((edge) => edge.to === toId && edge.labels?.includes(type))
        .map((edge) => edge.from),
  };
}

function isFieldEndpoint(id: string, index: GraphIndex): boolean {
  const node = index.nodeById.get(id);
  return (
    !!node && hasLabel(node, LABEL_FIELD) && !index.duplicateNodeIds.has(id)
  );
}

function readQualityExamples(raw: unknown): DataQualityFinding["examples"] {
  if (raw == null) return undefined;
  let values = raw;
  if (typeof raw === "string" && raw.startsWith("__json__:")) {
    try {
      values = JSON.parse(raw.slice("__json__:".length));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(values)) return null;

  const examples: DataQualityExample[] = [];
  for (const entry of values) {
    if (!isObject(entry) || !isCount(entry.row) || entry.row === 0) return null;
    const { row, value } = entry;
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "boolean" &&
      !(typeof value === "number" && Number.isFinite(value))
    )
      return null;
    examples.push({ row, value });
  }
  return examples;
}

function readDataQuality(
  recordSets: GraphNode[],
  index: GraphIndex,
): DataQualityReport {
  if (recordSets.length === 0) return { status: "unavailable" };
  const recordSetId = recordSets[0].id;
  if (
    recordSets.length !== 1 ||
    !recordSetId ||
    index.duplicateNodeIds.has(recordSetId)
  ) {
    return { status: "invalid" };
  }

  const reportIds = [
    ...new Set(index.reportTargetsOf(recordSetId, "HAS_DATA_QUALITY")),
  ];
  if (reportIds.length === 0) return { status: "unavailable" };
  const sourceFiles = new Set<string>();
  for (const id of index.reportTargetsOf(recordSetId, EDGE_FIELD)) {
    if (!id || !isFieldEndpoint(id, index)) return { status: "invalid" };
    for (const fileId of index.targetsOf(id, EDGE_SOURCE))
      sourceFiles.add(fileId);
  }
  // A RecordSet report cannot tell which file owns each finding when its fields span files.
  if (sourceFiles.size !== 1) return { status: "invalid" };
  const reportId = reportIds[0];
  if (!reportId) return { status: "invalid" };
  const report = index.nodeById.get(reportId);
  const summary = report?.properties?.summary;
  // An ambiguous or broken graph must not look like a completed clean check.
  if (
    reportIds.length !== 1 ||
    index.duplicateNodeIds.has(reportId) ||
    index
      .reportSourcesOf(reportId, "HAS_DATA_QUALITY")
      .some((owner) => owner !== recordSetId) ||
    !report ||
    !hasLabel(report, "dg:DataQuality") ||
    typeof summary !== "string" ||
    !summary.trim()
  ) {
    return { status: "invalid" };
  }

  const findings: DataQualityFinding[] = [];
  for (const id of new Set(index.reportTargetsOf(reportId, "HAS_ERROR"))) {
    if (!id) return { status: "invalid" };
    const finding = index.nodeById.get(id);
    if (
      !finding?.properties ||
      !hasLabel(finding, "dg:DataQualityError") ||
      index.duplicateNodeIds.has(id) ||
      index.reportSourcesOf(id, "HAS_ERROR").some((owner) => owner !== reportId)
    ) {
      return { status: "invalid" };
    }
    const { column, errorType, description, totalAffectedRows, examples } =
      finding.properties;
    if (
      typeof column !== "string" ||
      !column.trim() ||
      typeof errorType !== "string" ||
      !errorType.trim() ||
      typeof description !== "string" ||
      !description.trim()
    )
      return { status: "invalid" };
    findings.push({
      id,
      column,
      category: errorType,
      description,
      affectedRows: isCount(totalAffectedRows) ? totalAffectedRows : undefined,
      examples: readQualityExamples(examples),
    });
  }
  return { status: "available", summary, findings };
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
  matchingRecordSets: GraphNode[],
): FilePreviewDataUnion {
  const statsProps = (columnId: string) => {
    const statsId = index.targetsOf(columnId, EDGE_STATISTICS)[0];
    return statsId ? index.nodeById.get(statsId)?.properties : undefined;
  };

  const fields = columns.map((column) => {
    const id = column.id ?? "";
    const props = statsProps(id);
    const stats = mapColumnStatistics(id, props);
    const fileColumn: FileColumn = {
      id,
      name: String(column.properties?.name ?? ""),
      type: mapColumnType(column.properties?.dataType, stats),
      visible: true,
      description: (column.properties?.description as string) || undefined,
    };
    return { fileColumn, stats, rowCount: props?.rowCount };
  });
  const statistics = fields.map((field) => field.stats);

  const rows = buildRows(recordSet, columns);

  const rowCounts = fields.map((field) => field.rowCount).filter(isCount);
  const totalRows =
    rowCounts.length > 0 && rowCounts.every((count) => count === rowCounts[0])
      ? rowCounts[0]
      : undefined;

  const missingCounts = statistics
    .map((stat) => stat.nullCount)
    .filter(isCount);
  const totalCells =
    totalRows === undefined ? undefined : totalRows * columns.length;
  const totalMissingPercentage =
    rowCounts.length === columns.length &&
    missingCounts.length === columns.length &&
    totalCells !== undefined &&
    totalCells > 0
      ? (missingCounts.reduce((sum, count) => sum + count, 0) / totalCells) *
        100
      : undefined;

  return {
    type: "tabular",
    filename: String(file.properties?.name ?? ""),
    fileSize: String(file.properties?.contentSize ?? ""),
    description: "",
    columns: fields.map((field) => field.fileColumn),
    rows,
    totalRows,
    totalMissingPercentage,
    statistics,
    dataQuality:
      file.id && index.duplicateNodeIds.has(file.id)
        ? { status: "invalid" }
        : readDataQuality(matchingRecordSets, index),
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

    const matchingRecordSets = recordSets.filter((rs) =>
      index
        .targetsOf(rs.id ?? "", EDGE_FIELD)
        .some(
          (columnId) =>
            isFieldEndpoint(columnId, index) &&
            fileOfColumn(columnId) === fileId,
        ),
    );
    const recordSet = matchingRecordSets[0];

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
      data = buildTabular(file, columns, recordSet, index, matchingRecordSets);
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
