"use client";

import { useEffect, useState } from "react";
import type {
  FileColumn,
  FilePreviewData,
  FilePreviewTab,
} from "@/types/filePreview";
import AboutFile from "./AboutFile";
import DataQualityTab from "./DataQualityTab";
import ExtendedFilePreviewModal from "./ExtendedFilePreviewModal";
import styles from "./FilePreview.module.scss";
import FilePreviewHeader from "./FilePreviewHeader";
import FilePreviewTable from "./FilePreviewTable";
import FilePreviewTabs from "./FilePreviewTabs";
import ShowColumnsModal from "./ShowColumnsModal";
import StatisticsTab from "./StatisticsTab";

interface FilePreviewProps {
  fileData: FilePreviewData | null;
  onDownload?: () => void;
}

export default function FilePreview({
  fileData,
  onDownload,
}: FilePreviewProps) {
  const [activeTab, setActiveTab] = useState<FilePreviewTab>("preview");
  const [columns, setColumns] = useState<FileColumn[]>([]);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [extendedViewOpen, setExtendedViewOpen] = useState(false);

  useEffect(() => {
    if (fileData) {
      setColumns(fileData.columns);
      setActiveTab("preview");
    }
  }, [fileData]);

  if (!fileData) {
    return (
      <div className={styles.filePreview}>
        <div className={styles.filePreview__empty}>
          <p>Select a file to preview</p>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Default download behavior - create a test file
      const blob = new Blob(["Test file content"], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveColumns = (updatedColumns: FileColumn[]) => {
    setColumns(updatedColumns);
  };

  // Show all rows (no "Show more" button needed)
  const visibleRows = fileData.rows;

  return (
    <>
      <div className={styles.filePreview}>
        <FilePreviewHeader
          filename={fileData.filename}
          fileSize={fileData.fileSize}
          onDownload={handleDownload}
          onExtendedView={() => setExtendedViewOpen(true)}
        />

        <FilePreviewTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className={styles.filePreview__content}>
          {activeTab === "preview" && (
            <>
              <AboutFile description={fileData.description} />
              <FilePreviewTable
                columns={columns}
                rows={visibleRows}
                totalRows={fileData.totalRows}
                statistics={fileData.statistics}
                onShowColumnsClick={() => setShowColumnsModal(true)}
              />
            </>
          )}

          {activeTab === "statistics" && (
            <StatisticsTab
              statistics={fileData.statistics}
              columns={columns}
              totalRows={fileData.totalRows}
              totalMissingPercentage={fileData.totalMissingPercentage}
            />
          )}

          {activeTab === "dataQuality" && (
            <DataQualityTab
              dataQuality={fileData.dataQuality}
              columns={columns}
            />
          )}
        </div>
      </div>

      <ShowColumnsModal
        isOpen={showColumnsModal}
        columns={columns}
        onClose={() => setShowColumnsModal(false)}
        onSave={handleSaveColumns}
      />

      <ExtendedFilePreviewModal
        isOpen={extendedViewOpen}
        fileData={fileData}
        activeTab={activeTab}
        columns={columns}
        onClose={() => setExtendedViewOpen(false)}
        onTabChange={setActiveTab}
        onDownload={handleDownload}
        onSaveColumns={handleSaveColumns}
      />
    </>
  );
}
