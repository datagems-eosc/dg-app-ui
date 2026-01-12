"use client";

import { Button } from "@ui/Button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DatasetPlus } from "@/data/dataset";
import { getFilePreviewData } from "@/data/mockFilePreview";
import DatasetDescriptionSection from "./DatasetDescriptionSection/DatasetDescriptionSection";
import styles from "./DatasetDetailsPageContent.module.scss";
import DatasetFilesTree from "./DatasetFilesTree/DatasetFilesTree";
import DatasetHeader from "./DatasetHeader/DatasetHeader";
import DatasetMetadataBar from "./DatasetMetadataBar/DatasetMetadataBar";
import DatasetSidebar from "./DatasetSidebar/DatasetSidebar";
import DatasetSpecificationSection from "./DatasetSpecificationSection/DatasetSpecificationSection";
import DatasetTagsSection from "./DatasetTagsSection/DatasetTagsSection";
import DatasetUseCasesSection from "./DatasetUseCasesSection/DatasetUseCasesSection";
import FilePreview from "./FilePreview/FilePreview";

interface DatasetDetailsPageContentProps {
  dataset: DatasetPlus;
}

export default function DatasetDetailsPageContent({
  dataset,
}: DatasetDetailsPageContentProps) {
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = useState<string>("file1-csv");

  const handleFileSelect = (fileId: string, fileName: string) => {
    // Map file IDs to mock data IDs
    const mockFileMap: Record<string, string> = {
      file1: "file1-csv",
      "csv-file1": "file1-csv",
      "csv-file2": "file1-csv",
      file2: "file2-xlsx",
      "excel-file1": "file2-xlsx",
    };

    const mappedFileId = mockFileMap[fileId] || "file1-csv";
    setSelectedFileId(mappedFileId);
  };

  const filePreviewData = getFilePreviewData(selectedFileId);

  const displayCategory = (() => {
    if (dataset.collections && dataset.collections.length > 0) {
      const firstCollection = dataset.collections[0];
      return typeof firstCollection.name === "string"
        ? firstCollection.name.replace(/ Collection$/i, "")
        : firstCollection.name;
    }
    return dataset.category || "";
  })();

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
                onClick={() => router.back()}
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

          <h2 className={styles.datasetDetailsPageContent__sectionTitle}>
            Dataset Details
          </h2>

          <div className={styles.datasetDetailsPageContent__mainContent}>
            <div className={styles.datasetDetailsPageContent__leftColumn}>
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

              <div
                className={styles.datasetDetailsPageContent__filePreviewSection}
              >
                <div
                  className={
                    styles.datasetDetailsPageContent__filePreviewContainer
                  }
                >
                  <FilePreview fileData={filePreviewData} />
                  <DatasetFilesTree onFileSelect={handleFileSelect} />
                </div>
              </div>
            </div>

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
      </div>
    </div>
  );
}
