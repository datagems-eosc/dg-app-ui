export interface UserSettings {
  id?: string;
  key?: string;
  value?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  eTag?: string | null;
}

export interface UserSettingsPersist {
  id?: string;
  key?: string;
  value?: unknown;
  eTag?: string | null;
}
