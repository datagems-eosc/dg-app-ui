"use client";

import { Download } from "lucide-react";
import styles from "./DataQualityReportHeader.module.scss";

interface DataQualityReportHeaderProps {
  totalErrors: number;
  onDownloadReport?: () => void;
}

export default function DataQualityReportHeader({
  totalErrors,
  onDownloadReport,
}: DataQualityReportHeaderProps) {
  const handleDownload = () => {
    if (onDownloadReport) {
      onDownloadReport();
    } else {
      // Default: create a mock report file
      const reportData = {
        timestamp: new Date().toISOString(),
        totalErrors,
        message: "Full data quality report",
      };
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "data-quality-report.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <div className={styles.reportHeader}>
        <div className={styles.reportHeader__content}>
          <h4 className={styles.reportHeader__title}>Data Quality Report</h4>
          <p className={styles.reportHeader__description}>
            For a full report of the rows with error download the report (.json
            format)
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className={styles.reportHeader__button}
        >
          <Download className={styles.reportHeader__buttonIcon} />
          Error Report
        </button>
      </div>

      <div className={styles.totalErrors}>
        <span className={styles.totalErrors__label}>Total Errors</span>
        <span className={styles.totalErrors__value}>
          <span className={styles.totalErrors__count}>{totalErrors}</span>{" "}
          errors found
        </span>
      </div>
    </>
  );
}
