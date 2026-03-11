export interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date | string;
  sources?: number;
  relatedDatasetIds?: string[];
  datasetIds?: string[];
  tableData?: TableData;
  sqlQuery?: string;
  latitude?: number;
  longitude?: number;
  recommendations?: string[];
  recommendationsLoading?: boolean;
  datasetProposal?: Array<{ id: string; title: string }>;
  datasetProposalSubmitting?: boolean;
  datasetProposalResolved?: boolean;
}

export interface TableData {
  columns: Array<{ columnNumber: number; name: string }>;
  rows: Array<{
    rowNumber: number;
    cells: Array<{ column: string; value: string | number }>;
  }>;
}
