"use client";

import { AlertCircle, ChevronDown, ChevronUp, Hash, Type } from "lucide-react";
import { useMemo, useState } from "react";
import type { DataQualityMetric, FileColumn } from "@/types/filePreview";
import DataQualityReportHeader from "./DataQualityReportHeader";
import styles from "./DataQualityTab.module.scss";

interface DataQualityTabProps {
  dataQuality: DataQualityMetric[];
  columns: FileColumn[];
}

interface Card {
  id: string;
  icon?: typeof Hash | typeof Type;
  name: string;
  issueType: string;
  issueLabel?: string;
  description?: string;
  count?: number;
  showTable?: boolean;
}

export default function DataQualityTab({
  dataQuality,
  columns,
}: DataQualityTabProps) {
  // Dane z designu (statyczne) – używamy gdy brak realnych danych
  const designCards = useMemo(() => {
    return [
      {
        id: "birth-date",
        icon: Hash,
        name: "Birth Date",
        issueType: "format",
        issueLabel: "Format inconsistency",
        description: "Dates have the format YYYY-MM-DD, some have DD-MM-YYYY",
        count: 75,
        showTable: true,
      },
      {
        id: "location",
        icon: Type,
        name: "location",
        issueType: "outlier",
        issueLabel: "Value Error or Anomaly",
        description: "Values fall outside expected range",
        count: 40,
        showTable: false,
      },
      {
        id: "temperature",
        icon: Hash,
        name: "temperature",
        issueType: "format",
        issueLabel: "Format inconsistency",
        description: "Temperature format mismatch",
        count: 30,
        showTable: false,
      },
      {
        id: "precipitation",
        icon: Hash,
        name: "precipitation",
        issueType: "outlier",
        issueLabel: "Value Error or Anomaly",
        description: "Values fall outside expected range",
        count: 29,
        showTable: false,
      },
    ];
  }, []);

  // Jeśli mamy realne dane - mapujemy; inaczej fallback do designCards
  const cards: Card[] = useMemo(() => {
    const mapped: Card[] | null =
      dataQuality && dataQuality.length > 0
        ? dataQuality
            .map((q) => {
              const col = columns.find((c) => c.id === q.columnId);
              if (!col || !q.issues || q.issues.length === 0) return null;
              const mainIssue = q.issues[0];
              return {
                id: col.id,
                icon: col.type === "number" ? Hash : Type,
                name: col.name,
                issueType: mainIssue.type,
                issueLabel:
                  mainIssue.type === "format" || mainIssue.type === "missing"
                    ? "Format inconsistency"
                    : mainIssue.type === "outlier"
                      ? "Value Error or Anomaly"
                      : mainIssue.type === "duplicate"
                        ? "Duplicate values"
                        : "Data Quality",
                description: mainIssue.description,
                count: mainIssue.count,
                showTable: false,
              } as Card;
            })
            .filter((c): c is Card => c !== null)
        : null;
    return mapped && mapped.length > 0 ? mapped : designCards;
  }, [columns, dataQuality, designCards]);

  const totalErrors = cards.reduce((sum, c) => sum + (c?.count || 0), 0);

  const initialExpanded =
    cards.length > 0 ? new Set<string>([cards[0]!.id]) : new Set<string>();
  const [expandedCards, setExpandedCards] =
    useState<Set<string>>(initialExpanded);

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

  const issueLabel = (type: string) => {
    switch (type) {
      case "missing":
      case "format":
        return "Format inconsistency";
      case "outlier":
        return "Value Error or Anomaly";
      case "duplicate":
        return "Duplicate values";
      default:
        return "Data Quality";
    }
  };

  // Mockowane dane tabeli błędów zgodne z designem
  const errorRows = [
    { row: 13, error: "1986-08-12", shouldBe: "12-08-1986" },
    { row: 15, error: "1992-11-15", shouldBe: "15-11-1992" },
    { row: 35, error: "2001-03-22", shouldBe: "22-03-2001" },
    { row: 44, error: "2005-07-30", shouldBe: "30-07-2005" },
    { row: 54, error: "2010-09-18", shouldBe: "18-09-2010" },
    { row: 78, error: "2010-09-18", shouldBe: "18-09-2010" },
    { row: 187, error: "2010-09-18", shouldBe: "18-09-2010" },
    { row: 214, error: "2010-09-18", shouldBe: "18-09-2010" },
  ];

  return (
    <div className={styles.dataQualityTab}>
      <DataQualityReportHeader totalErrors={totalErrors} />
      <div className={styles.dataQualityTab__totalErrors}>
        <span className={styles.dataQualityTab__totalLabel}>Total Errors</span>
        <span className={styles.dataQualityTab__totalValue}>
          <span className={styles.dataQualityTab__totalValueHighlight}>
            {totalErrors}
          </span>{" "}
          errors found
        </span>
      </div>

      <div className={styles.dataQualityTab__grid}>
        {cards.map((card, idx) => {
          const isExpanded = expandedCards.has(card.id);
          const ColumnIcon = card.icon ?? getColumnIcon("text");

          return (
            <div key={card.id} className={styles.dataQualityTab__card}>
              <div className={styles.dataQualityTab__cardHeader}>
                <div className={styles.dataQualityTab__cardTitle}>
                  <ColumnIcon className={styles.dataQualityTab__columnIcon} />
                  <h4 className={styles.dataQualityTab__columnName}>
                    {card.name}
                  </h4>
                </div>
                <div className={styles.dataQualityTab__cardMeta}>
                  <div className={styles.dataQualityTab__issueTag}>
                    <AlertCircle className={styles.dataQualityTab__issueIcon} />
                    <span className={styles.dataQualityTab__issueText}>
                      {card.issueLabel || issueLabel(card.issueType)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCard(card.id)}
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

              {isExpanded && (
                <div className={styles.dataQualityTab__metrics}>
                  <div className={styles.dataQualityTab__errorDescription}>
                    <span className={styles.dataQualityTab__errorLabel}>
                      Error description
                    </span>
                    <p className={styles.dataQualityTab__errorText}>
                      {card.description}
                    </p>
                  </div>

                  {/* Pokazujemy tabelę tylko dla pierwszej karty (zgodnie z designem) */}
                  {card.showTable && (
                    <>
                      <div className={styles.dataQualityTab__errorTable}>
                        <div
                          className={styles.dataQualityTab__errorTableHeader}
                        >
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
                        {errorRows.map((row, i) => (
                          <div
                            key={i}
                            className={styles.dataQualityTab__errorTableRow}
                          >
                            <div
                              className={styles.dataQualityTab__errorTableCell}
                            >
                              {row.row}
                            </div>
                            <div
                              className={styles.dataQualityTab__errorTableCell}
                            >
                              {row.error}
                            </div>
                            <div
                              className={styles.dataQualityTab__errorTableCell}
                            >
                              {row.shouldBe}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={styles.dataQualityTab__errorSummary}>
                        <span
                          className={styles.dataQualityTab__errorSummaryLabel}
                        >
                          Total rows with this error:
                        </span>
                        <span
                          className={styles.dataQualityTab__errorSummaryValue}
                        >
                          {card.count}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
