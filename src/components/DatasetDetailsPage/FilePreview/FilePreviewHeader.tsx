"use client";

import { Download, Maximize2 } from "lucide-react";
import styles from "./FilePreviewHeader.module.scss";

interface FilePreviewHeaderProps {
  filename: string;
  fileSize: string;
  onDownload: () => void;
  onExtendedView: () => void;
}

export default function FilePreviewHeader({
  filename,
  fileSize,
  onDownload,
  onExtendedView,
}: FilePreviewHeaderProps) {
  return (
    <div className={styles.filePreviewHeader}>
      <div className={styles.filePreviewHeader__info}>
        <h3 className={styles.filePreviewHeader__filename}>{filename}</h3>
        <span className={styles.filePreviewHeader__filesize}>{fileSize}</span>
      </div>
      <div className={styles.filePreviewHeader__actions}>
        <button
          type="button"
          onClick={onDownload}
          className={styles.filePreviewHeader__iconButton}
          aria-label="Download file"
        >
          <Download className={styles.filePreviewHeader__icon} />
        </button>
        <button
          type="button"
          onClick={onExtendedView}
          className={styles.filePreviewHeader__iconButton}
          aria-label="Extended view"
        >
          <Maximize2 className={styles.filePreviewHeader__icon} />
        </button>
      </div>
    </div>
  );
}
