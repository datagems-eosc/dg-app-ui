"use client";

import { AlertCircle, ChevronDown, ChevronUp, Hash, Type } from "lucide-react";
import { useState } from "react";
import type { DataQualityMetric, FileColumn } from "@/types/filePreview";
import DataQualityReportHeader from "./DataQualityReportHeader";
import styles from "./DataQualityTab.module.scss";

interface DataQualityTabProps {
  dataQuality: DataQualityMetric[];
  columns: FileColumn[];
}

export default function DataQualityTab({
  dataQuality,
  columns,
}: DataQualityTabProps) {
  const visibleColumns = columns.filter((col) => col.visible);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Calculate total errors from all issues
  const totalErrors = dataQuality.reduce((total, metric) => {
    const issuesCount =
      metric.issues?.reduce((sum, issue) => sum + issue.count, 0) || 0;
    return total + issuesCount;
  }, 0);

  const toggleCard = (columnId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return newSet;
    });
  };

  const getColumnIcon = (type: string) => {
    if (type === "number") return Hash;
    return Type;
  };

  return (
    <div className={styles.dataQualityTab}>
      <DataQualityReportHeader totalErrors={totalErrors} />
      <div className={styles.dataQualityTab__grid}>
        {visibleColumns.map((column) => {
          const quality = dataQuality.find((q) => q.columnId === column.id);
          if (!quality || !quality.issues || quality.issues.length === 0)
            return null;

          const isExpanded = expandedCards.has(column.id);
          const ColumnIcon = getColumnIcon(column.type);
          const mainIssue = quality.issues[0];

          return (
            <div key={column.id} className={styles.dataQualityTab__card}>
              <div className={styles.dataQualityTab__cardHeader}>
                <div className={styles.dataQualityTab__cardTitle}>
                  <ColumnIcon className={styles.dataQualityTab__columnIcon} />
                  <h4 className={styles.dataQualityTab__columnName}>
                    {column.name}
                  </h4>
                </div>
                <div className={styles.dataQualityTab__cardMeta}>
                  <div className={styles.dataQualityTab__issueTag}>
                    <AlertCircle className={styles.dataQualityTab__issueIcon} />
                    <span className={styles.dataQualityTab__issueText}>
                      {mainIssue.type === "missing" && "Format inconsistency"}
                      {mainIssue.type === "outlier" && "Value Error or Anomaly"}
                      {mainIssue.type === "duplicate" && "Duplicate values"}
                      {mainIssue.type === "format" && "Format inconsistency"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCard(column.id)}
                    className={styles.dataQualityTab__expandButton}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronUp
                        className={styles.dataQualityTab__expandIcon}
                      />
                    ) : (
                      <ChevronDown
                        className={styles.dataQualityTab__expandIcon}
                      />
                    )}
                  </button>
                </div>
              </div>

              {isExpanded && quality.issues && (
                <div className={styles.dataQualityTab__metrics}>
                  <div className={styles.dataQualityTab__errorDescription}>
                    <span className={styles.dataQualityTab__errorLabel}>
                      Error description
                    </span>
                    <p className={styles.dataQualityTab__errorText}>
                      {mainIssue.description}
                    </p>
                  </div>

                  {/* Show mock table with error examples */}
                  <div className={styles.dataQualityTab__errorTable}>
                    <div className={styles.dataQualityTab__errorTableHeader}>
                      <div className={styles.dataQualityTab__errorTableCol}>
                        Row Number
                      </div>
                      <div className={styles.dataQualityTab__errorTableCol}>
                        Error Value
                      </div>
                      <div className={styles.dataQualityTab__errorTableCol}>
                        Should be
                      </div>
                    </div>
                    {[13, 15, 35, 44, 54].map((rowNum, idx) => (
                      <div
                        key={idx}
                        className={styles.dataQualityTab__errorTableRow}
                      >
                        <div className={styles.dataQualityTab__errorTableCell}>
                          {rowNum}
                        </div>
                        <div className={styles.dataQualityTab__errorTableCell}>
                          {column.type === "date"
                            ? `${1986 + idx * 5}-${String(((idx + 8) % 12) + 1).padStart(2, "0")}-${String(((idx * 7) % 28) + 1).padStart(2, "0")}`
                            : `Value ${rowNum}`}
                        </div>
                        <div className={styles.dataQualityTab__errorTableCell}>
                          {column.type === "date"
                            ? `${String(((idx + 8) % 12) + 1).padStart(2, "0")}-${String(((idx * 7) % 28) + 1).padStart(2, "0")}-${1986 + idx * 5}`
                            : `Corrected ${rowNum}`}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.dataQualityTab__errorSummary}>
                    <span className={styles.dataQualityTab__errorSummaryLabel}>
                      Total rows with this error:
                    </span>
                    <span className={styles.dataQualityTab__errorSummaryValue}>
                      {mainIssue.count}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
