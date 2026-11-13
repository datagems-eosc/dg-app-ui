"use client";

import { useEffect, useState } from "react";
import type { buildFilePreviews } from "@/lib/datasetProfile";
import type { FilePreviewDataUnion } from "@/types/filePreview";

type Entry = ReturnType<typeof buildFilePreviews>[number];
type PreviewState =
  | { status: "loading" }
  | { status: "ready"; data: FilePreviewDataUnion }
  | { status: "error"; message: string };

export function useFilePreviewContent(
  datasetId: string,
  entry: Entry | undefined,
  download: (datasetId: string, fileId: string) => Promise<Response>,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    datasetId: string;
    entry: Entry;
    state: PreviewState;
  } | null>(null);
  useEffect(() => {
    if (!entry || entry.data.type === "tabular") return;
    let cancelled = false;
    let objectUrl: string | undefined;
    setResult(null);
    const { id, data } = entry;
    const load = async () => {
      try {
        const response = await download(datasetId, id);
        let content: FilePreviewDataUnion;
        if (data.type === "json") {
          const text = await response.text();
          content = {
            ...data,
            content: text.split("\n").slice(0, 150).join("\n"),
          };
        } else if (data.type === "pdf") {
          const blob = await response.blob();
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          content = { ...data, fileUrl: objectUrl };
        } else return;
        if (!cancelled)
          setResult({
            datasetId,
            entry,
            state: { status: "ready", data: content },
          });
      } catch (error) {
        if (cancelled) return;
        const denied =
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          error.status === 403;
        setResult({
          datasetId,
          entry,
          state: {
            status: "error",
            message: denied
              ? "Previewing this file needs download access."
              : "We couldn't load the preview.",
          },
        });
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [datasetId, entry, download, attempt]);
  const state: PreviewState =
    entry?.data.type === "tabular"
      ? { status: "ready", data: entry.data }
      : result?.datasetId === datasetId && result.entry === entry
        ? result.state
        : { status: "loading" };
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
