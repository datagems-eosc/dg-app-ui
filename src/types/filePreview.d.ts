export interface FileColumn {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "boolean" | "numeric" | "categorical";
  visible: boolean;
  description?: string;
  inferredSemanticType?: string;
}

export interface FileRow {
  id: string;
  cells: {
    columnId: string;
    value: string | number | boolean | null;
  }[];
}

export interface ColumnStatistics {
  columnId: string;
  uniqueValues?: number;
  nullCount?: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  percentile05?: number;
  percentile95?: number;
  quantileSource?: "profiler";
  stdDev?: number;
  missingPercentage?: number;
  distribution?: number[];
  distributionRanges?: [number, number][];
  topValues?: { value: string | number; count: number }[];
}

export interface DataQualityExample {
  row: number;
  value: FileRow["cells"][number]["value"];
}

export interface DataQualityFinding {
  id: string;
  column: string;
  category: string;
  description: string;
  affectedRows?: number;
  examples?: DataQualityExample[] | null;
}

export type DataQualityReport =
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "available"; summary: string; findings: DataQualityFinding[] };

export interface FilePreviewData {
  type: "tabular";
  filename: string;
  fileSize: string;
  description: string;
  columns: FileColumn[];
  rows: FileRow[];
  totalRows?: number;
  totalMissingPercentage?: number;
  statistics: ColumnStatistics[];
  dataQuality: DataQualityReport;
}

export interface PdfFilePreviewData {
  type: "pdf";
  filename: string;
  fileSize: string;
  description: string;
  keywords?: string[];
  fileUrl: string;
  totalPages: number;
}

export interface JsonFilePreviewData {
  type: "json";
  filename: string;
  fileSize: string;
  description: string;
  keywords?: string[];
  content: string;
}

export type FilePreviewDataUnion =
  | FilePreviewData
  | PdfFilePreviewData
  | JsonFilePreviewData;

export type FilePreviewTab = "preview" | "statistics" | "dataQuality";
