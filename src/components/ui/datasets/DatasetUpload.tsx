"use client";

import { Link as LinkIcon, Upload } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
import { FileUploadCard } from "./FileUploadCard";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
  file?: File;
  stagedPath?: string;
}

interface DatasetUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onUpload: (
    files: File[],
    onProgress?: (loaded: number, total: number) => void,
  ) => Promise<string[]>;
  allowedExtensions?: string[];
  onRemoteUploadNotSupported?: (message: string) => void;
}

const REMOTE_LOCATIONS = [
  {
    id: "direct",
    label: "Direct url",
    icon: <Image src="/share.svg" alt="Direct" width={16} height={16} />,
  },
  {
    id: "s3",
    label: "Amazon S3",
    icon: <Image src="/aws.svg" alt="Amazon S3" width={16} height={16} />,
  },
  {
    id: "onedrive",
    label: "OneDrive",
    icon: <Image src="/one-drive.svg" alt="OneDrive" width={16} height={16} />,
  },
  {
    id: "dropbox",
    label: "Dropbox",
    icon: <Image src="/dropbox.svg" alt="Dropbox" width={16} height={16} />,
  },
  {
    id: "googledrive",
    label: "Google Drive",
    icon: (
      <Image src="/g-drive.svg" alt="Google Drive" width={16} height={16} />
    ),
  },
];

const DEFAULT_ACCEPT = ".csv,.pdf,.xlsx,.xls,.txt,.png,.jpeg,.jpg,.md";

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(7);
}

export function DatasetUpload({
  files,
  onFilesChange,
  onUpload,
  allowedExtensions,
  onRemoteUploadNotSupported,
}: DatasetUploadProps) {
  const [showRemoteLocation, setShowRemoteLocation] = useState(false);
  const [selectedRemoteType, setSelectedRemoteType] = useState<string>("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptAttr =
    allowedExtensions && allowedExtensions.length > 0
      ? allowedExtensions.join(",")
      : DEFAULT_ACCEPT;

  const performUpload = useCallback(
    async (filesToUpload: UploadedFile[], allFiles: UploadedFile[]) => {
      const withFile = filesToUpload.filter((f) => f.file);
      if (withFile.length === 0) return;

      setIsUploading(true);
      const fileObjects = withFile.map((f) => f.file as File);

      const progressCallback = (loaded: number, total: number) => {
        const pct =
          total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
        const updates = new Map(allFiles.map((f) => [f.id, f]));
        withFile.forEach((f) => {
          updates.set(f.id, { ...f, progress: pct });
        });
        onFilesChange(allFiles.map((f) => updates.get(f.id) ?? f));
      };

      try {
        const paths = await onUpload(fileObjects, progressCallback);
        const updates = new Map(allFiles.map((f) => [f.id, f]));
        withFile.forEach((f, idx) => {
          const path = paths[idx];
          updates.set(f.id, {
            ...f,
            progress: 100,
            status: path ? "success" : "error",
            stagedPath: path || undefined,
            error: path ? undefined : "No path returned",
          });
        });
        onFilesChange(allFiles.map((f) => updates.get(f.id) ?? f));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Upload failed. Please try again.";
        const errorUpdates = new Map(allFiles.map((f) => [f.id, f]));
        withFile.forEach((f) => {
          errorUpdates.set(f.id, {
            ...f,
            progress: 0,
            status: "error",
            error: message,
          });
        });
        onFilesChange(allFiles.map((f) => errorUpdates.get(f.id) ?? f));
      } finally {
        setIsUploading(false);
      }
    },
    [onFilesChange, onUpload],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isUploading) return;
      const selectedFiles = event.target.files;
      if (!selectedFiles?.length) return;

      const newFiles: UploadedFile[] = Array.from(selectedFiles).map(
        (file) => ({
          id: generateId(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          status: "uploading" as const,
          progress: 0,
          file,
        }),
      );

      const updated = [...files, ...newFiles];
      onFilesChange(updated);
      performUpload(newFiles, updated);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [files, isUploading, onFilesChange, performUpload],
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((f) => f.id !== fileId));
    },
    [files, onFilesChange],
  );

  const handleRetryFile = useCallback(
    (file: UploadedFile) => {
      if (!file.file) return;
      const retryFile: UploadedFile = {
        ...file,
        status: "uploading",
        progress: 0,
        error: undefined,
      };
      const allFiles = files.map((f) => (f.id === file.id ? retryFile : f));
      onFilesChange(allFiles);
      performUpload([retryFile], allFiles);
    },
    [files, onFilesChange, performUpload],
  );

  const handleBrowseFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddRemoteLocation = useCallback(() => {
    setShowRemoteLocation(true);
  }, []);

  const handleRemoteUpload = useCallback(() => {
    if (!remoteUrl.trim()) return;
    const message = "Remote URL upload requires administrator privileges.";
    if (onRemoteUploadNotSupported) {
      onRemoteUploadNotSupported(message);
      setRemoteUrl("");
      setSelectedRemoteType("");
      setShowRemoteLocation(false);
      return;
    }
    const newFile: UploadedFile = {
      id: generateId(),
      name: remoteUrl.split("/").pop() || "remote-file",
      size: 0,
      type: "remote",
      status: "error",
      progress: 0,
      error: message,
    };
    onFilesChange([...files, newFile]);
    setRemoteUrl("");
    setSelectedRemoteType("");
    setShowRemoteLocation(false);
  }, [files, onFilesChange, onRemoteUploadNotSupported, remoteUrl]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isUploading) return;
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        const fakeEvent = {
          target: { files: droppedFiles },
        } as React.ChangeEvent<HTMLInputElement>;
        handleFileSelect(fakeEvent);
      }
    },
    [handleFileSelect, isUploading],
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative rounded-lg p-6 sm:p-10 text-center transition-colors group overflow-hidden bg-slate-75 ${isUploading ? "pointer-events-none opacity-70" : ""}`}
        aria-busy={isUploading}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x="0.5"
            y="0.5"
            width="calc(100% - 1px)"
            height="calc(100% - 1px)"
            rx="8"
            ry="8"
            className="fill-none stroke-slate-300 group-hover:stroke-slate-400"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>
        <div className="flex flex-col items-center space-y-3 sm:space-y-4">
          <Upload
            strokeWidth={2.5}
            className="w-6 h-6 sm:w-7.5 sm:h-7.5 text-slate-350"
            aria-hidden
          />
          <div className="space-y-1 sm:space-y-2">
            <p className="text-body-14-medium sm:text-body-16-medium text-gray-750">
              Drop files here or add from remote location
            </p>
            <p className="text-body-12-regular sm:text-body-14-regular text-gray-650">
              Supported formats: CSV, PDF, XLSX (max 500MB per file)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2 pt-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleBrowseFiles}
              className="w-full sm:w-auto"
            >
              Browse local files
            </Button>
            <p className="text-body-12-regular sm:text-body-14-regular text-gray-650 hidden sm:block">
              OR
            </p>
            <Button
              variant="outline"
              onClick={handleAddRemoteLocation}
              className="w-full sm:w-auto"
            >
              Add remote location
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptAttr}
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden
      />

      {showRemoteLocation && (
        <div>
          <h4 className="text-body-14-semibold sm:text-body-16-semibold text-gray-750 mb-3 sm:mb-4">
            Choose remote location
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            {REMOTE_LOCATIONS.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => setSelectedRemoteType(location.id)}
                className={`p-2 sm:p-3 border rounded-lg flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2 text-body-12-medium sm:text-body-14-medium text-gray-750 transition-colors ${
                  selectedRemoteType === location.id
                    ? "border-blue-850 bg-blue-75"
                    : "border-slate-200 hover:border-slate-350 hover:shadow-s2 hover:cursor-pointer"
                }`}
              >
                {location.icon}
                <span className="text-center">{location.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full items-end">
            <div className="flex-1 min-w-0">
              <Input
                label="URL"
                icon={<LinkIcon className="w-4 h-4 text-icon" />}
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://server.com/file.csv..."
              />
            </div>
            <Button
              className="w-full sm:w-auto shrink-0 whitespace-nowrap"
              onClick={handleRemoteUpload}
              disabled={!remoteUrl.trim() || !selectedRemoteType}
            >
              Upload dataset
            </Button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file) => (
            <FileUploadCard
              key={file.id}
              file={file}
              onRemove={() => handleRemoveFile(file.id)}
              onRetry={
                file.status === "error" && file.file
                  ? () => handleRetryFile(file)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
