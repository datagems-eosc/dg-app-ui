"use client";

import { AlertCircle, ChevronDown, Hash, Type } from "lucide-react";
import type { DataQualityReport, FileColumn } from "@/types/filePreview";
import DataQualityReportHeader from "./DataQualityReportHeader";
import styles from "./DataQualityTab.module.scss";

interface DataQualityTabProps {
  dataQuality: DataQualityReport;
  columns: FileColumn[];
}

const categoryLabels: Record<string, string> = {
  consistency_error: "Consistency error",
  duplicate: "Duplicate values",
  format_inconsistency: "Format inconsistency",
  missing_value: "Missing values",
  outlier: "Outlier",
};

function labelCategory(category: string): string {
  return Object.hasOwn(categoryLabels, category)
    ? categoryLabels[category]
    : category.replaceAll("_", " ");
}

export default function DataQualityTab({
  dataQuality,
  columns,
}: DataQualityTabProps) {
  if (dataQuality.status === "unavailable") {
    return (
      <div className={styles.dataQualityTab__message}>
        <p>No data quality report available.</p>
        <p>Data quality checks run during profiling.</p>
      </div>
    );
  }

  if (dataQuality.status === "invalid") {
    return (
      <p className={styles.dataQualityTab__message}>
        The data quality report could not be loaded.
      </p>
    );
  }

  return (
    <div className={styles.dataQualityTab}>
      <DataQualityReportHeader summary={dataQuality.summary} />
      {dataQuality.findings.length === 0 && (
        <p className={styles.dataQualityTab__message}>
          No data quality issues found.
        </p>
      )}
      {dataQuality.findings.map((finding) => {
        const matches = columns.filter(
          (candidate) => candidate.name === finding.column,
        );
        const column = matches.length === 1 ? matches[0] : undefined;
        const ColumnIcon =
          column?.type === "numeric" || column?.type === "number" ? Hash : Type;
        return (
          <details className={styles.dataQualityTab__card} key={finding.id}>
            <summary className={styles.dataQualityTab__cardHeader} tabIndex={0}>
              <span className={styles.dataQualityTab__cardTitle}>
                {column && (
                  <ColumnIcon
                    aria-hidden="true"
                    className={styles.dataQualityTab__columnIcon}
                  />
                )}
                <span className={styles.dataQualityTab__columnName}>
                  {finding.column}
                </span>
              </span>
              <span className={styles.dataQualityTab__issueTag}>
                <AlertCircle
                  aria-hidden="true"
                  className={styles.dataQualityTab__issueIcon}
                />
                {labelCategory(finding.category)}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={styles.dataQualityTab__expandIcon}
              />
            </summary>
            <div className={styles.dataQualityTab__metrics}>
              <p>{finding.description}</p>
              <p>
                Affected rows:{" "}
                {finding.affectedRows?.toLocaleString("en-US") ??
                  "Not available"}
              </p>
              {finding.examples === null && (
                <p>Examples could not be loaded.</p>
              )}
              {finding.examples && finding.examples.length > 0 && (
                <div className={styles.dataQualityTab__tableBorder}>
                  <table
                    className={styles.dataQualityTab__errorTable}
                    aria-label="Reported examples"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Row number</th>
                        <th scope="col">Reported value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finding.examples.map(({ row, value }, index) => (
                        <tr key={`${row}-${index}`}>
                          <td>{row}</td>
                          <td>{value === null ? "Empty" : String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
