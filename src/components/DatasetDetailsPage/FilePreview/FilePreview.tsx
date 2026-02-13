"use client";

import { useEffect, useState } from "react";
import type {
  FileColumn,
  FilePreviewData,
  FilePreviewDataUnion,
  FilePreviewTab,
} from "@/types/filePreview";
import AboutFile from "./AboutFile";
import DataQualityTab from "./DataQualityTab";
import ExtendedFilePreviewModal from "./ExtendedFilePreviewModal";
import styles from "./FilePreview.module.scss";
import FilePreviewHeader from "./FilePreviewHeader";
import FilePreviewTable from "./FilePreviewTable";
import FilePreviewTabs from "./FilePreviewTabs";
import JsonFilePreview from "./JsonFilePreview";
import PdfFilePreview from "./PdfFilePreview";
import ShowColumnsModal from "./ShowColumnsModal";
import StatisticsTab from "./StatisticsTab";

interface FilePreviewProps {
  fileData: FilePreviewDataUnion | null;
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
    if (fileData && fileData.type === "tabular") {
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

  if (fileData.type === "pdf") {
    const handleDownload = () => {
      if (onDownload) {
        onDownload();
      } else {
        fetch(fileData.fileUrl)
          .then((r) => r.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileData.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          });
      }
    };
    return (
      <div className={styles.filePreview}>
        <PdfFilePreview data={fileData} onDownload={handleDownload} />
      </div>
    );
  }

  if (fileData.type === "json") {
    const handleJsonDownload = () => {
      if (onDownload) {
        onDownload();
      } else {
        const blob = new Blob([fileData.content], {
          type: "application/json",
        });
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
    return (
      <div className={styles.filePreview}>
        <JsonFilePreview data={fileData} onDownload={handleJsonDownload} />
      </div>
    );
  }

  const tabularData = fileData as FilePreviewData;
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const blob = new Blob(["Test file content"], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tabularData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveColumns = (updatedColumns: FileColumn[]) => {
    setColumns(updatedColumns);
  };

  const visibleRows = tabularData.rows;

  return (
    <>
      <div className={styles.filePreview}>
        <FilePreviewHeader
          filename={tabularData.filename}
          fileSize={tabularData.fileSize}
          onDownload={handleDownload}
          onExtendedView={() => setExtendedViewOpen(true)}
        />

        <FilePreviewTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className={styles.filePreview__content}>
          {activeTab === "preview" && (
            <>
              <AboutFile description={tabularData.description} />
              <FilePreviewTable
                columns={columns}
                rows={visibleRows}
                totalRows={tabularData.totalRows}
                statistics={tabularData.statistics}
                onShowColumnsClick={() => setShowColumnsModal(true)}
              />
            </>
          )}

          {activeTab === "statistics" && (
            <StatisticsTab
              statistics={tabularData.statistics}
              columns={columns}
              totalRows={tabularData.totalRows}
              totalMissingPercentage={tabularData.totalMissingPercentage}
            />
          )}

          {activeTab === "dataQuality" && (
            <DataQualityTab
              dataQuality={tabularData.dataQuality}
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
        fileData={tabularData}
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
