"use client";

import React from "react";
import { X, FileText, CheckCircle, XCircle } from "lucide-react";
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

  const getFileIcon = () => {
    return <FileText className="w-4 h-4 text-slate-500" />;
  };

  const getStatusIcon = () => {
    switch (file.status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case "success":
        return "File uploaded";
      case "error":
        return "Upload failed";
      case "uploading":
        return "Uploading...";
      default:
        return "";
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {getFileIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-slate-850 truncate">
                {file.name}
              </p>
              {getStatusIcon()}
            </div>
            <p className="text-xs text-slate-500">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0"
          aria-label="Remove file"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              file.status === "success"
                ? "bg-green-600"
                : file.status === "error"
                  ? "bg-red-600"
                  : "bg-blue-600"
            )}
            style={{ width: `${file.progress}%` }}
          />
        </div>
      </div>

      {/* Status text */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs",
            file.status === "success"
              ? "text-green-600"
              : file.status === "error"
                ? "text-red-600"
                : "text-slate-600"
          )}
        >
          {getStatusText()}
        </span>
        {file.status === "uploading" && (
          <span className="text-xs text-slate-500">{file.progress}%</span>
        )}
      </div>

      {/* Error message */}
      {file.status === "error" && file.error && (
        <p className="text-xs text-red-600 mt-1">{file.error}</p>
      )}
    </div>
  );
}
