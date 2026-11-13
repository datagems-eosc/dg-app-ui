"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
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
import ShowColumnsModal from "./ShowColumnsModal";
import StatisticsTab from "./StatisticsTab";

const PdfFilePreview = dynamic(() => import("./PdfFilePreview"), {
  ssr: false,
});

interface FilePreviewProps {
  fileData: FilePreviewDataUnion | null;
  onDownload?: () => void;
}

export default function FilePreview({
  fileData,
  onDownload,
}: FilePreviewProps) {
  const tabId = useId();
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
    return (
      <div className={styles.filePreview}>
        <PdfFilePreview data={fileData} onDownload={onDownload} />
      </div>
    );
  }

  if (fileData.type === "json") {
    return (
      <div className={styles.filePreview}>
        <JsonFilePreview data={fileData} onDownload={onDownload} />
      </div>
    );
  }

  const tabularData = fileData as FilePreviewData;
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
          onDownload={onDownload}
          onExtendedView={() => setExtendedViewOpen(true)}
        />

        <FilePreviewTabs
          idPrefix={tabId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div
          className={styles.filePreview__content}
          role="tabpanel"
          id={`${tabId}-panel`}
          aria-labelledby={`${tabId}-${activeTab}`}
        >
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
        onDownload={onDownload}
        onSaveColumns={handleSaveColumns}
      />
    </>
  );
}
