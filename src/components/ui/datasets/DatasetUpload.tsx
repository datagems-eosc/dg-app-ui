"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Upload, Link as LinkIcon } from "lucide-react";
import { Button } from "../Button";
import { Input } from "../Input";
import { FileUploadCard } from "./FileUploadCard";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface DatasetUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
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

export function DatasetUpload({ files, onFilesChange }: DatasetUploadProps) {
  const [showRemoteLocation, setShowRemoteLocation] = useState(false);
  const [selectedRemoteType, setSelectedRemoteType] = useState<string>("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<UploadedFile[]>(files);

  // Keep a ref to the latest files to avoid stale closures during simulated uploads
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading",
      progress: 0,
    }));

    // Add new files to existing files
    onFilesChange([...files, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach((file) => {
      simulateUpload(file.id);
    });

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const simulateUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // Randomly simulate success or error for demo
        const isSuccess = Math.random() > 0.2; // 80% success rate

        const updated: UploadedFile[] = filesRef.current.map((file) =>
          file.id === fileId
            ? {
                ...file,
                progress: 100,
                status: isSuccess ? ("success" as const) : ("error" as const),
                error: !isSuccess
                  ? "Upload failed. Please try again."
                  : undefined,
              }
            : file
        );
        filesRef.current = updated;
        onFilesChange(updated);
      } else {
        const updated: UploadedFile[] = filesRef.current.map((file) =>
          file.id === fileId
            ? { ...file, progress: Math.round(progress) }
            : file
        );
        filesRef.current = updated;
        onFilesChange(updated);
      }
    }, 200);
  };

  const handleRemoveFile = (fileId: string) => {
    onFilesChange(files.filter((file) => file.id !== fileId));
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleAddRemoteLocation = () => {
    setShowRemoteLocation(true);
  };

  const handleRemoteUpload = () => {
    if (!remoteUrl.trim()) return;

    // Create a mock file from URL
    const fileName = remoteUrl.split("/").pop() || "remote-file";
    const newFile: UploadedFile = {
      id: Math.random().toString(36).substring(7),
      name: fileName,
      size: 0, // Unknown size for remote files
      type: "remote",
      status: "uploading",
      progress: 0,
    };

    onFilesChange([...files, newFile]);
    simulateUpload(newFile.id);

    // Reset remote form
    setRemoteUrl("");
    setSelectedRemoteType("");
    setShowRemoteLocation(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      // Create a fake event to reuse the handleFileSelect logic
      const fakeEvent = {
        target: { files: droppedFiles },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative rounded-lg p-6 sm:p-10 text-center transition-colors group overflow-hidden bg-slate-75"
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.pdf,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Remote Location Section */}
      {showRemoteLocation && (
        <div>
          <h4 className="text-body-14-semibold sm:text-body-16-semibold text-gray-750 mb-3 sm:mb-4">
            Choose remote location
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            {REMOTE_LOCATIONS.map((location) => (
              <button
                key={location.id}
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

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file) => (
            <FileUploadCard
              key={file.id}
              file={file}
              onRemove={() => handleRemoveFile(file.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
