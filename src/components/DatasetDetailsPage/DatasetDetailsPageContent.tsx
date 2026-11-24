"use client";

import { Button } from "@ui/Button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { useFilePreviewContent } from "@/hooks/useFilePreviewContent";
import { useOriginalFileDownload } from "@/hooks/useOriginalFileDownload";
import { sharingStateFromLegacyAccess } from "@/lib/datasetPermissions/model";
import {
  buildFilePreviews,
  buildFileTree,
  type ProfileTreeNode,
  parseProfileRaw,
} from "@/lib/datasetProfile";
import { deriveProfileMetadata } from "@/lib/datasetProfileMetadata";
import { getNavigationUrl } from "@/lib/utils";
import DatasetDescriptionSection from "./DatasetDescriptionSection/DatasetDescriptionSection";
import styles from "./DatasetDetailsPageContent.module.scss";
import DatasetFilesTree from "./DatasetFilesTree/DatasetFilesTree";
import { type FileNode, findFileTreeNode } from "./DatasetFilesTree/fileTree";
import DatasetHeader from "./DatasetHeader/DatasetHeader";
import DatasetMetadataBar from "./DatasetMetadataBar/DatasetMetadataBar";
import DatasetProfilingSections from "./DatasetProfilingSections/DatasetProfilingSections";
import DatasetRecommendationsSection from "./DatasetRecommendationsSection/DatasetRecommendationsSection";
import DatasetSidebar from "./DatasetSidebar/DatasetSidebar";
import DatasetTagsSection from "./DatasetTagsSection/DatasetTagsSection";
import FilePreview from "./FilePreview/FilePreview";

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
  /** The fields-of-science names are still loading. */
  fieldsOfSciencePending?: boolean;
  returnToRoles?: boolean;
}

export default function DatasetDetailsPageContent({
  dataset,
  fieldsOfSciencePending = false,
  returnToRoles = false,
}: DatasetDetailsPageContentProps) {
  const router = useRouter();
  const { downloadDatasetFile, sessionPrincipalId } = useApi();

  const metadata = useMemo(
    () => deriveProfileMetadata(dataset.profileRaw),
    [dataset.profileRaw],
  );
  const previewEntries = useMemo(
    () => buildFilePreviews(dataset.profileRaw),
    [dataset.profileRaw],
  );

  const { fileNodes, unreadableProfile } = useMemo(() => {
    const fileNodes = mapTreeToFileNodes(buildFileTree(dataset.profileRaw));
    return {
      fileNodes,
      unreadableProfile:
        fileNodes.length === 0 &&
        dataset.profileRaw != null &&
        !parseProfileRaw(dataset.profileRaw),
    };
  }, [dataset.profileRaw]);

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const selectedEntry =
    previewEntries.find((entry) => entry.id === selectedFileId) ??
    (selectedFileId === null ? previewEntries[0] : undefined);
  const preview = useFilePreviewContent(
    dataset.id,
    selectedEntry,
    downloadDatasetFile,
  );

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  // Anything that is not "Open Access" used to become "Restricted" here, which
  // turned every dataset whose publication we cannot establish into a warning
  // badge. A source that carries the legacy binary label still maps to it; a
  // source that carries an explicit sharing state wins; everything else stays
  // unknown.
  const sharing =
    dataset.sharing ?? sharingStateFromLegacyAccess(dataset.access);

  // `undefined` means the permission evidence was unreadable, `[]` that the
  // read returned nothing to display. The distinction is passed on rather than
  // collapsed, because the two states read differently to a user.
  const permissions = dataset.permissions;
  const hasBrowsePermission = permissions?.includes("Browse") ?? false;
  const hasEditPermission = permissions?.includes("Edit") ?? false;
  const hasDownloadPermission = permissions?.includes("Download") ?? false;
  const hasManagePermission = permissions?.includes("Manage") ?? false;
  const selectedDownloadId =
    selectedFileId ?? selectedEntry?.id ?? fileNodes[0]?.id;
  const downloadFile = findFileTreeNode(
    fileNodes,
    (node) => node.type === "file" && node.id === selectedDownloadId,
  );
  const canDownload =
    hasDownloadPermission && !!downloadFile && !!sessionPrincipalId;
  const originalDownload = useOriginalFileDownload(
    {
      datasetId: dataset.id,
      fileId: downloadFile?.id,
      filename: downloadFile?.name ?? "download",
      principalId: sessionPrincipalId,
      allowed: canDownload,
    },
    downloadDatasetFile,
  );

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
            </div>
            <DatasetHeader dataset={dataset} />
          </div>

          <DatasetMetadataBar dataset={dataset} metadata={metadata} />

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
                {dataset.fieldOfScience &&
                  dataset.fieldOfScience.length > 0 && (
                    <DatasetTagsSection
                      title="Fields of Science"
                      items={dataset.fieldOfScience}
                      isLoading={fieldsOfSciencePending}
                    />
                  )}
                {dataset.keywords && dataset.keywords.length > 0 && (
                  <DatasetTagsSection
                    title="Keywords"
                    items={dataset.keywords}
                  />
                )}
                <DatasetProfilingSections entries={metadata.profiling} />
              </div>
            </div>

            <div className={styles.datasetDetailsPageContent__rowRight}>
              <DatasetSidebar
                dataset={dataset}
                sharing={sharing}
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
              <div className="flex items-start gap-4">
                <h2 className={styles.datasetDetailsPageContent__sectionTitle}>
                  File Preview
                </h2>
                {canDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={
                      originalDownload.status === "pending"
                        ? "Downloading file"
                        : "Download file"
                    }
                    disabled={originalDownload.status === "pending"}
                    onClick={() => void originalDownload.start()}
                  >
                    {originalDownload.status === "pending"
                      ? "Downloading..."
                      : "Download"}
                  </Button>
                )}
              </div>
              {originalDownload.status === "error" && (
                <p
                  role="alert"
                  className={styles.datasetDetailsPageContent__downloadError}
                >
                  Download failed. Try again.
                </p>
              )}
              {unreadableProfile ? (
                <p
                  role="status"
                  className={styles.datasetDetailsPageContent__statusText}
                >
                  The file profile could not be loaded.
                </p>
              ) : fileNodes.length === 0 ? (
                <p className={styles.datasetDetailsPageContent__statusText}>
                  No files are available to preview for this dataset.
                </p>
              ) : !selectedEntry ? (
                <p className={styles.datasetDetailsPageContent__statusText}>
                  No preview for this file.
                </p>
              ) : preview.status === "loading" ? (
                <div
                  role="status"
                  aria-busy="true"
                  className="h-96 w-full animate-pulse rounded-lg bg-slate-100"
                >
                  <p className={styles.datasetDetailsPageContent__statusText}>
                    Loading preview...
                  </p>
                </div>
              ) : preview.status === "error" ? (
                <div
                  role="status"
                  className={styles.datasetDetailsPageContent__previewState}
                >
                  <h3
                    className={styles.datasetDetailsPageContent__previewTitle}
                  >
                    {selectedEntry.data.filename}
                  </h3>
                  {selectedEntry.data.fileSize && (
                    <p
                      className={styles.datasetDetailsPageContent__previewMeta}
                    >
                      {selectedEntry.data.fileSize}
                    </p>
                  )}
                  <p className={styles.datasetDetailsPageContent__statusText}>
                    {preview.message}
                  </p>
                  <Button onClick={preview.retry}>Try again</Button>
                </div>
              ) : (
                <FilePreview fileData={preview.data} />
              )}
            </div>

            <div className={styles.datasetDetailsPageContent__rowRight}>
              {fileNodes.length > 0 && (
                <DatasetFilesTree
                  files={fileNodes}
                  onFileSelect={handleFileSelect}
                />
              )}
            </div>
          </div>

          <DatasetRecommendationsSection datasetId={dataset.id} />
        </div>
      </div>
    </div>
  );
}
