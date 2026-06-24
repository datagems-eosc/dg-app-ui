export type ToastType = "success" | "error";

export interface ToastConfig {
  readonly message: string;
  readonly type: ToastType;
}

export const TOAST_MESSAGES: {
  readonly datasetAddedToCollection: ToastConfig;
  readonly datasetAddedToNamedCollection: (
    collectionName: string,
  ) => ToastConfig;
  readonly datasetAddedToMultipleCollections: (count: number) => ToastConfig;
  readonly datasetRemovedFromCollection: (
    collectionName?: string,
  ) => ToastConfig;
  readonly datasetsRemovedFromCollection: (
    count: number,
    collectionName?: string,
  ) => ToastConfig;
  readonly datasetRemoveFailed: ToastConfig;
  readonly collectionDeleted: ToastConfig;
  readonly collectionDeleteFailed: ToastConfig;
};
