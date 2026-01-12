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

const RECORDS_PER_PAGE = 100;

export default function FilePreview({
  fileData,
  onDownload,
}: FilePreviewProps) {
  const [activeTab, setActiveTab] = useState<FilePreviewTab>("preview");
  const [columns, setColumns] = useState<FileColumn[]>([]);
  const [displayedRows, setDisplayedRows] = useState(RECORDS_PER_PAGE);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [extendedViewOpen, setExtendedViewOpen] = useState(false);

  useEffect(() => {
    if (fileData) {
      setColumns(fileData.columns);
      setDisplayedRows(RECORDS_PER_PAGE);
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

  const handleLoadMore = () => {
    setDisplayedRows((prev) =>
      Math.min(prev + RECORDS_PER_PAGE, fileData.totalRows),
    );
  };

  const handleSaveColumns = (updatedColumns: FileColumn[]) => {
    setColumns(updatedColumns);
  };

  const visibleRows = fileData.rows.slice(0, displayedRows);

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
                onShowColumnsClick={() => setShowColumnsModal(true)}
                onLoadMore={
                  displayedRows < fileData.totalRows
                    ? handleLoadMore
                    : undefined
                }
              />
            </>
          )}

          {activeTab === "statistics" && (
            <StatisticsTab statistics={fileData.statistics} columns={columns} />
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
        displayedRows={displayedRows}
        onClose={() => setExtendedViewOpen(false)}
        onTabChange={setActiveTab}
        onDownload={handleDownload}
        onLoadMore={handleLoadMore}
        onSaveColumns={handleSaveColumns}
      />
    </>
  );
}
