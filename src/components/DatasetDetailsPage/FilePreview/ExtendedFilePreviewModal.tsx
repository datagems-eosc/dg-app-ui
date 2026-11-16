"use client";

import { Download, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useModalFocus } from "@/hooks/useModalFocus";
import type {
  FileColumn,
  FilePreviewData,
  FilePreviewTab,
} from "@/types/filePreview";
import AboutFile from "./AboutFile";
import DataQualityTab from "./DataQualityTab";
import styles from "./ExtendedFilePreviewModal.module.scss";
import FilePreviewTable from "./FilePreviewTable";
import FilePreviewTabs from "./FilePreviewTabs";
import ShowColumnsModal from "./ShowColumnsModal";
import StatisticsTab from "./StatisticsTab";

interface ExtendedFilePreviewModalProps {
  isOpen: boolean;
  fileData: FilePreviewData;
  activeTab: FilePreviewTab;
  columns: FileColumn[];
  onClose: () => void;
  onTabChange: (tab: FilePreviewTab) => void;
  onDownload?: () => void;
  onSaveColumns: (columns: FileColumn[]) => void;
}

export default function ExtendedFilePreviewModal({
  isOpen,
  fileData,
  activeTab,
  columns,
  onClose,
  onTabChange,
  onDownload,
  onSaveColumns,
}: ExtendedFilePreviewModalProps) {
  const tabId = useId();
  const [showColumnsModal, setShowColumnsModal] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus({ active: isOpen, containerRef: dialogRef, onEscape: onClose });
  if (!isOpen) return null;

  const visibleRows = fileData.rows;

  return (
    <>
      <div className={styles.extendedModal}>
        <div className={styles.extendedModal__overlay} onClick={onClose} />
        <div
          className={styles.extendedModal__content}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Extended view"
          tabIndex={-1}
        >
          <div className={styles.extendedModal__header}>
            <div className={styles.extendedModal__headerInfo}>
              <h3 className={styles.extendedModal__filename}>
                {fileData.filename}
              </h3>
              <span className={styles.extendedModal__filesize}>
                {fileData.fileSize}
              </span>
            </div>
            <div className={styles.extendedModal__headerActions}>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className={styles.extendedModal__iconButton}
                  aria-label="Download file"
                >
                  <Download className={styles.extendedModal__icon} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={styles.extendedModal__iconButton}
                aria-label="Close"
              >
                <X className={styles.extendedModal__icon} />
              </button>
            </div>
          </div>

          <FilePreviewTabs
            idPrefix={tabId}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />

          <div
            className={styles.extendedModal__body}
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-${activeTab}`}
          >
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
      </div>

      <ShowColumnsModal
        isOpen={showColumnsModal}
        columns={columns}
        onClose={() => setShowColumnsModal(false)}
        onSave={onSaveColumns}
      />
    </>
  );
}
