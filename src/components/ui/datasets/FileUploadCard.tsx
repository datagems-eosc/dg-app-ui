"use client";

import React from "react";
import { X, HardDrive, XCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadCardProps {
  file: {
    name: string;
    size: number;
    type: string;
    status: "uploading" | "success" | "error";
    progress: number;
    error?: string;
  };
  onRemove: () => void;
}

export function FileUploadCard({ file, onRemove }: FileUploadCardProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Upload className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case "success":
        return "File uploaded";
      case "error":
        return `Upload Failed${file.error ? `. ${file.error}` : "."}`;
      case "uploading":
        return "Uploading...";
      default:
        return "";
    }
  };

  return (
    <div className="rounded-lg p-4 bg-slate-75">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p
            className={cn(
              "text-body-16-medium truncate",
              file.status === "error" ? "text-slate-450" : "text-gray-750"
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
                file.status === "error" ? "text-slate-450" : "text-gray-650"
              )}
            >
              {formatFileSize(file.size)}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-450" />
            <div className="flex items-center gap-1.5 min-w-0">
              {getStatusIcon()}
              <span
                className={cn(
                  "truncate",
                  "text-body-14-regular",
                  file.status === "success"
                    ? "text-emerald-600"
                    : file.status === "error"
                      ? "text-red-550"
                      : "text-gray-650"
                )}
                title={getStatusText()}
              >
                {getStatusText()}
              </span>
            </div>
          </div>

          <div className="mt-2">
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300 bg-blue-850"
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={onRemove}
          className="self-center p-1.5 bg-white cursor-pointer hover:bg-slate-100 rounded-sm transition-colors flex-shrink-0"
          aria-label="Remove file"
        >
          <X className="w-5 h-5 text-icon" />
        </button>
      </div>
    </div>
  );
}
