"use client";

import { Button } from "@ui/Button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import { getDisplayCategory } from "@/config/collectionConstants";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import {
  buildFilePreviews,
  buildFileTree,
  type ProfileTreeNode,
} from "@/lib/datasetProfile";
import { logError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";
import type { FilePreviewDataUnion } from "@/types/filePreview";
import DatasetDescriptionSection from "./DatasetDescriptionSection/DatasetDescriptionSection";
import styles from "./DatasetDetailsPageContent.module.scss";
import type { FileNode } from "./DatasetFilesTree/DatasetFilesTree";
import DatasetFilesTree from "./DatasetFilesTree/DatasetFilesTree";
import DatasetHeader from "./DatasetHeader/DatasetHeader";
import DatasetMetadataBar from "./DatasetMetadataBar/DatasetMetadataBar";
import DatasetRecommendationsSection from "./DatasetRecommendationsSection/DatasetRecommendationsSection";
import DatasetSidebar from "./DatasetSidebar/DatasetSidebar";
import DatasetSpecificationSection from "./DatasetSpecificationSection/DatasetSpecificationSection";
import DatasetTagsSection from "./DatasetTagsSection/DatasetTagsSection";
import DatasetUseCasesSection from "./DatasetUseCasesSection/DatasetUseCasesSection";
import FilePreview from "./FilePreview/FilePreview";

const JSON_PREVIEW_MAX_LINES = 150;

function extensionFromMime(mime?: string): string | undefined {
  if (!mime) return undefined;
  if (mime.includes("csv")) return "csv";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "xlsx";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("json")) return "json";
  return undefined;
}

function mapTreeToFileNodes(nodes: ProfileTreeNode[]): FileNode[] {
  return nodes.map((node) =>
    node.kind === "folder"
      ? {
          id: node.id,
          name: node.name,
          type: "folder",
          children: mapTreeToFileNodes(node.children ?? []),
        }
      : {
          id: node.id,
          name: node.name,
          type: "file",
          extension: extensionFromMime(node.mimeType),
        },
  );
}

interface DatasetDetailsPageContentProps {
  dataset: DatasetPlus;
  returnToRoles?: boolean;
}

export default function DatasetDetailsPageContent({
  dataset,
  returnToRoles = false,
}: DatasetDetailsPageContentProps) {
  const router = useRouter();
  const { downloadDatasetFile } = useApi();

  const previewEntries = useMemo(
    () => buildFilePreviews(dataset.profileRaw),
    [dataset.profileRaw],
  );

  const fileNodes: FileNode[] = useMemo(
    () => mapTreeToFileNodes(buildFileTree(dataset.profileRaw)),
    [dataset.profileRaw],
  );

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loadedContent, setLoadedContent] = useState<
    Record<string, FilePreviewDataUnion>
  >({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!selectedFileId && previewEntries.length > 0) {
      setSelectedFileId(previewEntries[0].id);
    }
  }, [previewEntries, selectedFileId]);

  const selectedEntry = previewEntries.find(
    (entry) => entry.id === selectedFileId,
  );

  // Tabular previews are fully described by the profile; JSON/PDF need the
  // file bytes, fetched lazily on selection to save bandwidth.
  useEffect(() => {
    if (!selectedEntry) return;
    const { id, data } = selectedEntry;
    if (data.type === "tabular" || loadedContent[id]) return;

    let cancelled = false;
    setIsPreviewLoading(true);
    (async () => {
      try {
        const response = await downloadDatasetFile(dataset.id, id);
        if (data.type === "json") {
          const text = await response.text();
          const content = text
            .split("\n")
            .slice(0, JSON_PREVIEW_MAX_LINES)
            .join("\n");
          if (!cancelled) {
            setLoadedContent((prev) => ({
              ...prev,
              [id]: { ...data, content },
            }));
          }
        } else if (data.type === "pdf") {
          const blob = await response.blob();
          const fileUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setLoadedContent((prev) => ({
              ...prev,
              [id]: { ...data, fileUrl },
            }));
          }
        }
      } catch (error) {
        logError("Failed to load file preview content", error, {
          datasetId: dataset.id,
          fileId: id,
        });
      } finally {
        if (!cancelled) setIsPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEntry, dataset.id, downloadDatasetFile, loadedContent]);

  const filePreviewData: FilePreviewDataUnion | null = selectedEntry
    ? (loadedContent[selectedEntry.id] ?? selectedEntry.data)
    : null;

  const isAwaitingContent =
    selectedEntry != null &&
    selectedEntry.data.type !== "tabular" &&
    !loadedContent[selectedEntry.id] &&
    isPreviewLoading;

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  const displayCategory = getDisplayCategory(
    dataset.collections,
    dataset.category || "",
  );

  const displayAccess =
    dataset.access === "Open Access" ? "Open Access" : "Restricted";

  const permissions = dataset.permissions || [];
  const hasBrowsePermission = permissions.includes("Browse");
  const hasEditPermission = permissions.includes("Edit");
  const hasDownloadPermission = permissions.includes("Download");
  const hasManagePermission = permissions.includes("Manage");

  return (
    <div className={styles.datasetDetailsPageContent}>
      <div className={styles.datasetDetailsPageContent__container}>
        <div className={styles.datasetDetailsPageContent__wrapper}>
          <div className={styles.datasetDetailsPageContent__header}>
            <div className={styles.datasetDetailsPageContent__actions}>
              <button
                onClick={() =>
                  returnToRoles
                    ? router.push(getNavigationUrl(APP_ROUTES.SETTINGS_ROLES))
                    : router.back()
                }
                className={styles.datasetDetailsPageContent__backButton}
              >
                <ArrowLeft
                  className={styles.datasetDetailsPageContent__backIcon}
                />
                Back
              </button>
              <div className={styles.datasetDetailsPageContent__actionButtons}>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  Select
                </Button>
                <Button variant="outline" size="sm">
                  0 Selected
                </Button>
              </div>
            </div>
            <DatasetHeader dataset={dataset} />
          </div>

          <DatasetMetadataBar dataset={dataset} />

          {/* Row 1: Dataset Details (Description sections) + Metadata Sidebar */}
          <div className={styles.datasetDetailsPageContent__row}>
            <div className={styles.datasetDetailsPageContent__rowLeft}>
              <h2 className={styles.datasetDetailsPageContent__sectionTitle}>
                Dataset Details
              </h2>
              <div className={styles.datasetDetailsPageContent__sections}>
                <DatasetDescriptionSection
                  description={dataset.description || ""}
                />
                <DatasetSpecificationSection
                  specification={dataset.specification}
                />
                <DatasetUseCasesSection useCases={dataset.useCases} />
                {dataset.fieldOfScience &&
                  dataset.fieldOfScience.length > 0 && (
                    <DatasetTagsSection
                      title="Fields of Science"
                      items={dataset.fieldOfScience}
                    />
                  )}
                {dataset.keywords && dataset.keywords.length > 0 && (
                  <DatasetTagsSection
                    title="Keywords"
                    items={dataset.keywords}
                  />
                )}
              </div>
            </div>

            <div className={styles.datasetDetailsPageContent__rowRight}>
              <DatasetSidebar
                dataset={dataset}
                displayCategory={displayCategory}
                displayAccess={displayAccess}
                permissions={permissions}
                hasBrowsePermission={hasBrowsePermission}
                hasEditPermission={hasEditPermission}
                hasDownloadPermission={hasDownloadPermission}
                hasManagePermission={hasManagePermission}
              />
            </div>
          </div>

          {/* Row 2: File Preview + Dataset Files Tree */}
          <div className={styles.datasetDetailsPageContent__row}>
            <div className={styles.datasetDetailsPageContent__rowLeft}>
              <h2 className={styles.datasetDetailsPageContent__sectionTitle}>
                File Preview
              </h2>
              {isAwaitingContent ? (
                <div
                  aria-busy="true"
                  className="h-96 w-full animate-pulse rounded-lg bg-slate-100"
                />
              ) : (
                <FilePreview fileData={filePreviewData} />
              )}
            </div>

            <div className={styles.datasetDetailsPageContent__rowRight}>
              <DatasetFilesTree
                files={fileNodes}
                onFileSelect={handleFileSelect}
              />
            </div>
          </div>

          <DatasetRecommendationsSection datasetId={dataset.id} />
        </div>
      </div>
    </div>
  );
}
