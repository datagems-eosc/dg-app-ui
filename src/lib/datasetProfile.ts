import type {
  ColumnStatistics,
  FileColumn,
  FilePreviewDataUnion,
  FileRow,
} from "@/types/filePreview";

/**
 * Minimal shapes for the MOMA dataset profile (`profileRaw`), which is
 * Croissant JSON-LD with a DataGEMS `dg:` extension. See
 * datagems-eosc/dg-dataset-profiler docs/profile-examples-moma.md.
 */
interface CroissantStatistics {
  rowCount?: number | null;
  mean?: number | null;
  median?: number | null;
  standardDeviation?: number | null;
  min?: number | string | null;
  max?: number | string | null;
  missingCount?: number | null;
  missingPercentage?: number | null;
  uniqueCount?: number | null;
  histogram?: string | null;
}

interface CroissantField {
  "@id"?: string;
  name?: string;
  description?: string;
  dataType?: string;
  source?: { fileObject?: { "@id"?: string } };
  sample?: unknown[];
  statistics?: CroissantStatistics;
}

interface CroissantRecordSet {
  "@id"?: string;
  name?: string;
  field?: CroissantField[];
}

interface CroissantDistribution {
  "@id"?: string;
  "@type"?: string;
  name?: string;
  contentSize?: string;
  encodingFormat?: string;
  containedIn?: { "@id"?: string } | null;
}

export interface ProfileTreeNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  mimeType?: string;
  children?: ProfileTreeNode[];
}

export interface CroissantProfile {
  distribution?: CroissantDistribution[];
  recordSet?: CroissantRecordSet[];
}

export interface FilePreviewEntry {
  id: string; // distribution @id — the fileObjectNodeId used for download
  name: string;
  mimeType?: string;
  data: FilePreviewDataUnion;
}

const NUMERIC_TYPES = new Set([
  "sc:Integer",
  "sc:Float",
  "sc:Number",
  "sc:Decimal",
  "sc:Long",
]);

const TABULAR_MIMES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const JSON_MIMES = new Set(["application/json", "application/x-ipynb+json"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProfileRaw(raw: unknown): CroissantProfile | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isObject(parsed) ? (parsed as CroissantProfile) : null;
    } catch {
      return null;
    }
  }
  return isObject(raw) ? (raw as CroissantProfile) : null;
}

function mapColumnType(dataType?: string): FileColumn["type"] {
  if (!dataType) return "categorical";
  if (NUMERIC_TYPES.has(dataType)) return "numeric";
  if (dataType === "sc:Boolean") return "boolean";
  if (dataType === "sc:Date" || dataType === "sc:DateTime") return "date";
  return "categorical";
}

function parseHistogram(histogram?: string | null): number[] | undefined {
  if (!histogram) return undefined;
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

export function mapFieldStatistics(field: CroissantField): ColumnStatistics {
  const source = field.statistics ?? {};
  const stat: ColumnStatistics = {
    columnId: field["@id"] ?? field.name ?? "",
  };
  if (typeof source.uniqueCount === "number")
    stat.uniqueValues = source.uniqueCount;
  if (typeof source.missingCount === "number")
    stat.nullCount = source.missingCount;
  if (source.min != null) stat.min = source.min;
  if (source.max != null) stat.max = source.max;
  if (typeof source.mean === "number") stat.mean = source.mean;
  if (typeof source.median === "number") stat.median = source.median;
  if (typeof source.standardDeviation === "number") {
    stat.stdDev = source.standardDeviation;
  }
  if (typeof source.missingPercentage === "number") {
    stat.missingPercentage = source.missingPercentage;
  }
  const distribution = parseHistogram(source.histogram);
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

export function transposeSamplesToRows(
  fields: { "@id"?: string; sample?: unknown[] }[],
  limit = 100,
): FileRow[] {
  const rowCount = Math.min(
    limit,
    fields.reduce((max, field) => Math.max(max, field.sample?.length ?? 0), 0),
  );
  const rows: FileRow[] = [];
  for (let index = 0; index < rowCount; index++) {
    rows.push({
      id: String(index),
      cells: fields.map((field) => ({
        columnId: field["@id"] ?? "",
        value: normalizeCell(field.sample?.[index]),
      })),
    });
  }
  return rows;
}

function recordSetForFile(
  profile: CroissantProfile,
  fileId: string,
): CroissantRecordSet | undefined {
  return profile.recordSet?.find((recordSet) =>
    recordSet.field?.some(
      (field) => field.source?.fileObject?.["@id"] === fileId,
    ),
  );
}

function buildTabular(
  recordSet: CroissantRecordSet,
  distribution: CroissantDistribution,
): FilePreviewDataUnion {
  const fields = recordSet.field ?? [];
  const columns: FileColumn[] = fields.map((field) => ({
    id: field["@id"] ?? field.name ?? "",
    name: field.name ?? "",
    type: mapColumnType(field.dataType),
    visible: true,
    description: field.description || undefined,
  }));
  const rows = transposeSamplesToRows(fields);
  const statistics = fields.map(mapFieldStatistics);

  const rowCounts = fields
    .map((field) => field.statistics?.rowCount)
    .filter((count): count is number => typeof count === "number");
  const totalRows = rowCounts.length > 0 ? rowCounts[0] : rows.length;

  // File-level "missing values" = all missing cells / all cells. Equivalent to
  // the mean of per-column percentages when every column shares a row count,
  // but robust when they differ.
  const missingCounts = fields
    .map((field) => field.statistics?.missingCount)
    .filter((count): count is number => typeof count === "number");
  const totalCells = totalRows * fields.length;
  const totalMissingPercentage =
    missingCounts.length > 0 && totalCells > 0
      ? (missingCounts.reduce((sum, count) => sum + count, 0) / totalCells) *
        100
      : undefined;

  return {
    type: "tabular",
    filename: distribution.name ?? recordSet.name ?? "",
    fileSize: distribution.contentSize ?? "",
    description: "",
    columns,
    rows,
    totalRows,
    totalMissingPercentage,
    statistics,
    dataQuality: [],
  };
}

/**
 * Converts a parsed Croissant profile into one preview entry per file, with the
 * UI-ready `FilePreviewDataUnion`. Tabular content (columns/rows/statistics) is
 * derived from the profile; JSON text and PDF bytes are fetched separately on
 * node click (their `content`/`fileUrl` are left empty here).
 */
export function buildFilePreviews(raw: unknown): FilePreviewEntry[] {
  const profile = parseProfileRaw(raw);
  if (!profile) return [];

  const distributions = Array.isArray(profile.distribution)
    ? profile.distribution
    : [];
  const entries: FilePreviewEntry[] = [];

  for (const distribution of distributions) {
    // FileSets are folders, not previewable files.
    if (distribution["@type"] === "cr:FileSet") continue;
    const id = distribution["@id"];
    if (!id) continue;
    const name = distribution.name ?? "";
    const mime = distribution.encodingFormat;
    const fileSize = distribution.contentSize ?? "";

    let data: FilePreviewDataUnion;
    if (mime === "application/pdf") {
      data = {
        type: "pdf",
        filename: name,
        fileSize,
        description: "",
        fileUrl: "",
        totalPages: 0,
      };
    } else if (mime && JSON_MIMES.has(mime)) {
      data = {
        type: "json",
        filename: name,
        fileSize,
        description: "",
        content: "",
      };
    } else if (mime && TABULAR_MIMES.has(mime)) {
      const recordSet = recordSetForFile(profile, id);
      data = recordSet
        ? buildTabular(recordSet, distribution)
        : {
            type: "tabular",
            filename: name,
            fileSize,
            description: "",
            columns: [],
            rows: [],
            totalRows: 0,
            statistics: [],
            dataQuality: [],
          };
    } else {
      continue;
    }

    entries.push({ id, name, mimeType: mime, data });
  }

  return entries;
}

/**
 * Builds the nested file tree from the profile's `distribution`: `cr:FileSet`
 * entries are folders, `cr:FileObject` entries are files nested under their
 * `containedIn` folder (or at the root when they have none).
 */
export function buildFileTree(raw: unknown): ProfileTreeNode[] {
  const profile = parseProfileRaw(raw);
  if (!profile) return [];

  const distributions = Array.isArray(profile.distribution)
    ? profile.distribution
    : [];

  const folders = new Map<string, ProfileTreeNode>();
  for (const distribution of distributions) {
    const id = distribution["@id"];
    if (distribution["@type"] === "cr:FileSet" && id) {
      folders.set(id, {
        id,
        name: distribution.name ?? "",
        kind: "folder",
        children: [],
      });
    }
  }

  const roots: ProfileTreeNode[] = [];
  for (const distribution of distributions) {
    const id = distribution["@id"];
    if (!id) continue;

    let node: ProfileTreeNode | undefined;
    if (distribution["@type"] === "cr:FileSet") {
      node = folders.get(id);
    } else {
      node = {
        id,
        name: distribution.name ?? "",
        kind: "file",
        mimeType: distribution.encodingFormat,
      };
    }
    if (!node) continue;

    const parentId = distribution.containedIn?.["@id"];
    const parent =
      parentId && parentId !== id ? folders.get(parentId) : undefined;
    if (parent) {
      parent.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
