export interface User {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  idpSubjectId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  eTag?: string | null;
}

export interface UserQueryResult {
  items?: User[] | null;
  count?: number;
}

export interface UserGroup {
  id?: string | null;
  name?: string | null;
  semantics?: string[] | null;
}

export interface UserGroupQueryResult {
  items?: UserGroup[] | null;
  count?: number;
}

export interface UserLookup {
  ids?: string[] | null;
  excludedIds?: string[] | null;
  idpSubjectIds?: string[] | null;
  like?: string | null;
  page?: Record<string, unknown>;
  order?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  project?: Record<string, unknown>;
}

export interface UserGroupLookup {
  ids?: string[] | null;
  excludedIds?: string[] | null;
  semantics?: string[] | null;
  like?: string | null;
  page?: Record<string, unknown>;
  order?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  project?: Record<string, unknown>;
}
