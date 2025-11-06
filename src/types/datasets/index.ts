// API dataset type
export type ApiDataset = {
  id: string;
  code?: string;
  name?: string;
  collections?: {
    id: string;
    code: string;
    name: string;
    datasetCount?: number;
  }[];
  permissions?: string[];
};

export type MockDataset = {
  id: string;
  title?: string;
  description?: string;
  size?: string;
  lastUpdated?: string;
  tags?: string[];
  category?: string;
  access?: string;
};

export type DatasetUnion = MockDataset | ApiDataset;
