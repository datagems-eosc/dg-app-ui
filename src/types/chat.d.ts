export interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date | string;
  sources?: number;
  relatedDatasetIds?: string[];
  tableData?: TableData;
  latitude?: number;
  longitude?: number;
}

export interface TableData {
  columns: Array<{ columnNumber: number; name: string }>;
  rows: Array<{
    rowNumber: number;
    cells: Array<{ column: string; value: string | number }>;
  }>;
}
