export interface FileColumn {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "boolean" | "numeric" | "categorical";
  visible: boolean;
  description?: string;
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
  stdDev?: number;
  missingPercentage?: number;
  distribution?: number[];
  topValues?: { value: string | number; count: number }[];
}

export interface DataQualityMetric {
  columnId: string;
  completeness?: number;
  accuracy?: number;
  consistency?: number;
  issues?: {
    type: "missing" | "outlier" | "duplicate" | "format";
    count: number;
    description: string;
  }[];
}

export interface FilePreviewData {
  type: "tabular";
  filename: string;
  fileSize: string;
  description: string;
  columns: FileColumn[];
  rows: FileRow[];
  totalRows: number;
  totalMissingPercentage?: number;
  statistics: ColumnStatistics[];
  dataQuality: DataQualityMetric[];
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
