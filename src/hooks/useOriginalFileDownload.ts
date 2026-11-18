"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { downloadFilename, saveOriginalFile } from "@/lib/fileDownload";

interface DownloadTarget {
  datasetId: string;
  fileId: string | undefined;
  filename: string;
  principalId: string | null;
  allowed: boolean;
}

type Download = (
  datasetId: string,
  fileId: string,
  signal?: AbortSignal,
) => Promise<Response>;
type Status = "idle" | "pending" | "error";

export function useOriginalFileDownload(
  { datasetId, fileId, filename, principalId, allowed }: DownloadTarget,
  download: Download,
) {
  const operation = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useLayoutEffect(() => {
    setStatus("idle");
    return () => {
      operation.current?.abort();
      operation.current = null;
    };
  }, [datasetId, fileId, principalId, allowed]);

  const start = async () => {
    if (operation.current || !allowed || !fileId || !datasetId || !principalId)
      return;
    const controller = new AbortController();
    operation.current = controller;
    setStatus("pending");
    // Transport can finish after an abort, including while reading the body.
    const isCurrent = () =>
      !controller.signal.aborted && operation.current === controller;
    try {
      const response = await download(datasetId, fileId, controller.signal);
      if (!isCurrent()) return;
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      if (!isCurrent()) return;
      saveOriginalFile(blob, downloadFilename(response, filename));
      setStatus("idle");
    } catch {
      if (isCurrent()) setStatus("error");
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  };
  return { status, start };
}
