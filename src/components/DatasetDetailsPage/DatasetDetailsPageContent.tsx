"use client";

import { Button } from "@ui/Button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import type { DatasetPlus } from "@/data/dataset";
import { useApi } from "@/hooks/useApi";
import { useFilePreviewContent } from "@/hooks/useFilePreviewContent";
import { sharingStateFromLegacyAccess } from "@/lib/datasetPermissions/model";
import {
  buildFilePreviews,
  buildFileTree,
  type ProfileTreeNode,
} from "@/lib/datasetProfile";
import { deriveProfileMetadata } from "@/lib/datasetProfileMetadata";
import { getNavigationUrl } from "@/lib/utils";
import DatasetDescriptionSection from "./DatasetDescriptionSection/DatasetDescriptionSection";
import styles from "./DatasetDetailsPageContent.module.scss";
import type { FileNode } from "./DatasetFilesTree/DatasetFilesTree";
import DatasetFilesTree from "./DatasetFilesTree/DatasetFilesTree";
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
  returnToRoles?: boolean;
}

export default function DatasetDetailsPageContent({
  dataset,
  returnToRoles = false,
}: DatasetDetailsPageContentProps) {
  const router = useRouter();
  const { downloadDatasetFile } = useApi();

  const metadata = useMemo(
    () => deriveProfileMetadata(dataset.profileRaw),
    [dataset.profileRaw],
  );
  const previewEntries = useMemo(
    () => buildFilePreviews(dataset.profileRaw),
    [dataset.profileRaw],
  );

  const fileNodes: FileNode[] = useMemo(
    () => mapTreeToFileNodes(buildFileTree(dataset.profileRaw)),
    [dataset.profileRaw],
  );

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
              <h2 className={styles.datasetDetailsPageContent__sectionTitle}>
                File Preview
              </h2>
              {fileNodes.length === 0 ? (
                <p>No files are available to preview for this dataset.</p>
              ) : !selectedEntry ? (
                <p>No preview for this file.</p>
              ) : preview.status === "loading" ? (
                <div
                  role="status"
                  aria-busy="true"
                  className="h-96 w-full animate-pulse rounded-lg bg-slate-100"
                >
                  Loading preview...
                </div>
              ) : preview.status === "error" ? (
                <div role="status">
                  <h3>{selectedEntry.data.filename}</h3>
                  {selectedEntry.data.fileSize && (
                    <p>{selectedEntry.data.fileSize}</p>
                  )}
                  <p>{preview.message}</p>
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
