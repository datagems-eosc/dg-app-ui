export type ToastType = "success" | "error";

export interface ToastConfig {
  readonly message: string;
  readonly type: ToastType;
}

export const TOAST_MESSAGES: {
  readonly datasetAddedToCollection: ToastConfig;
};
