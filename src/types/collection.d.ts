export interface Collection {
  id: string;
  code?: string;
  name: string;
  datasetCount?: number;
  datasetIds?: string[];
  permissions?: string[];
  datasets?: Array<{ id: string; code: string; name: string }>;
  icon?: string;
  createdAt?: Date;
}

export interface ApiCollection {
  id: string;
  code?: string;
  name: string;
  datasets?: Array<{ id: string; code: string; name: string }>;
  datasetCount?: number;
  datasetIds?: string[];
  permissions?: string[];
  icon?: string;
}

export interface UserCollection {
  id: string;
  name: string;
  datasetIds: string[];
  createdAt: Date;
  icon?: string;
}

export interface SimpleCollection {
  id?: string;
  name: string;
} 