"use client";

import { HardDrive, RefreshCw, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadCardProps {
  file: {
    name: string;
    size: number;
    type: string;
    status: "uploading" | "success" | "error";
    progress: number;
    /**
     * Diagnostic text from the transfer. Deliberately never rendered, not even
     * as a tooltip: it can be arbitrary server text or an internal message,
     * which is not a user-safe display contract. The card shows generic,
     * actionable guidance instead.
     */
    error?: string;
  };
  onRemove: () => void;
  onRetry?: () => void;
}

export function FileUploadCard({
  file,
  onRemove,
  onRetry,
}: FileUploadCardProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const getStatusIcon = () => {
    switch (file.status) {
      case "success":
        return (
          <img
            src="/circle-check.svg"
            alt="Upload successful"
            className="w-4 h-4"
          />
        );
      case "error":
        return (
          <img src="/circle-x.svg" alt="Upload failed" className="w-4 h-4" />
        );
      default:
        return <Upload className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case "success":
        return "File uploaded";
      case "error":
        return "Upload failed";
      case "uploading":
        return "Uploading…";
      default:
        return "";
    }
  };

  // Points at the controls this card actually shows. Retry upload repeats only
  // this file's transfer; it is never offered for a submitted dataset.
  const failureGuidance =
    file.status !== "error"
      ? null
      : onRetry
        ? "Retry the upload, or remove this file if you don't need it."
        : "Remove this file, then add it again.";

  // Joined rather than merged through `cn`: tailwind-merge drops this
  // project's custom typography classes when a text colour is merged in the
  // same call. red-600 keeps these messages readable on the slate-75 row.
  const statusClass = [
    "text-body-14-regular",
    file.status === "success"
      ? "text-emerald-600"
      : file.status === "error"
        ? "text-red-600"
        : "text-gray-650",
  ].join(" ");

  return (
    <div className="rounded-lg p-4 bg-slate-75">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p
            className={cn(
              "text-body-16-medium truncate",
              file.status === "error" ? "text-slate-450" : "text-gray-750",
            )}
            title={file.name}
          >
            {file.name}
          </p>

          <div className="mt-1 flex items-center gap-2 text-xs">
            <HardDrive
              className={`w-4 h-4 ${file.status === "error" ? "text-slate-450" : "text-icon"}`}
            />
            <span
              className={cn(
                "text-body-14-regular",
                file.status === "error" ? "text-slate-450" : "text-gray-650",
              )}
            >
              {formatFileSize(file.size)}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-450" />
            <div className="flex items-center gap-1.5 min-w-0">
              {getStatusIcon()}
              <span className={`truncate ${statusClass}`}>
                {getStatusText()}
              </span>
            </div>
          </div>

          {failureGuidance === null ? null : (
            // Wraps below the summary, so it is neither truncated nor pushes
            // the Retry/Remove controls out of the row.
            <p className="mt-1 break-words text-body-14-regular text-red-600">
              {failureGuidance}
            </p>
          )}

          <div className="mt-2">
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300 bg-blue-850"
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* `type="button"`: these sit inside the add-dataset form, where an
              untyped button would also submit it. */}
          {file.status === "error" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="self-center p-1.5 bg-white cursor-pointer hover:bg-slate-100 rounded-sm transition-colors"
              aria-label="Retry upload"
            >
              <RefreshCw className="w-5 h-5 text-icon" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="self-center p-1.5 bg-white cursor-pointer hover:bg-slate-100 rounded-sm transition-colors"
            aria-label="Remove file"
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
