"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ColumnStatistics,
  FileColumn,
  FileRow,
} from "@/types/filePreview";
import styles from "./FilePreviewTable.module.scss";
import MiniHistogram from "./MiniHistogram";

interface FilePreviewTableProps {
  columns: FileColumn[];
  rows: FileRow[];
  totalRows: number;
  statistics: ColumnStatistics[];
  onShowColumnsClick: () => void;
  onLoadMore?: () => void;
}

type SortDirection = "asc" | "desc" | null;

export default function FilePreviewTable({
  columns,
  rows,
  totalRows,
  statistics,
  onShowColumnsClick,
  onLoadMore,
}: FilePreviewTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const visibleColumns = useMemo(
    () => columns.filter((col) => col.visible),
    [columns],
  );

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return rows;

    return [...rows].sort((a, b) => {
      const cellA = a.cells.find((c) => c.columnId === sortColumn);
      const cellB = b.cells.find((c) => c.columnId === sortColumn);

      const valueA = cellA?.value ?? "";
      const valueB = cellB?.value ?? "";

      if (typeof valueA === "number" && typeof valueB === "number") {
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }

      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();

      if (sortDirection === "asc") {
        return strA < strB ? -1 : strA > strB ? 1 : 0;
      }
      return strB < strA ? -1 : strB > strA ? 1 : 0;
    });
  }, [rows, sortColumn, sortDirection]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  const hasMoreRows = rows.length < totalRows;

  return (
    <div className={styles.filePreviewTable}>
      <div className={styles.filePreviewTable__header}>
        <div /> {/* Spacer */}
        <button
          type="button"
          onClick={onShowColumnsClick}
          className={styles.filePreviewTable__columnToggle}
        >
          <span>
            <span style={{ color: "#314158" }}>Showing:</span>{" "}
            {visibleColumns.length} of {columns.length} columns
          </span>
        </button>
      </div>

      <div className={styles.filePreviewTable__wrapper}>
        <table className={styles.filePreviewTable__table}>
          <thead className={styles.filePreviewTable__thead}>
            {/* Row 1: Column names with sort icons */}
            <tr className={styles.filePreviewTable__headerRow}>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={styles.filePreviewTable__th}
                  onClick={() => handleSort(column.id)}
                >
                  <div className={styles.filePreviewTable__thContent}>
                    <span className={styles.filePreviewTable__colName}>
                      {column.name}
                    </span>
                    <div className={styles.filePreviewTable__sortIcons}>
                      {sortColumn === column.id ? (
                        sortDirection === "asc" ? (
                          <ArrowUp
                            className={styles.filePreviewTable__sortIcon}
                          />
                        ) : (
                          <ArrowDown
                            className={styles.filePreviewTable__sortIcon}
                          />
                        )
                      ) : null}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
            {/* Row 2: Descriptions, histograms, and statistics */}
            <tr className={styles.filePreviewTable__statsRow}>
              {visibleColumns.map((column, index) => {
                const stats = statistics.find((s) => s.columnId === column.id);
                const isNumeric =
                  column.type === "numeric" || column.type === "number";
                const isFirstColumn = index === 0;

                return (
                  <th
                    key={`stats-${column.id}`}
                    className={styles.filePreviewTable__statsCell}
                  >
                    {isFirstColumn && stats ? (
                      <div
                        className={styles.filePreviewTable__firstColumnStats}
                      >
                        <div className={styles.filePreviewTable__largeNumber}>
                          {stats.uniqueValues || totalRows}
                        </div>
                        <div className={styles.filePreviewTable__description}>
                          {column.description || "Unique values in this column"}
                        </div>
                      </div>
                    ) : isNumeric &&
                      stats?.distribution &&
                      stats.min !== undefined &&
                      stats.max !== undefined ? (
                      <div
                        className={styles.filePreviewTable__histogramContainer}
                      >
                        <MiniHistogram
                          values={stats.distribution}
                          min={
                            typeof stats.min === "number"
                              ? stats.min
                              : Number.parseFloat(String(stats.min))
                          }
                          max={
                            typeof stats.max === "number"
                              ? stats.max
                              : Number.parseFloat(String(stats.max))
                          }
                          minLabel={`${stats.min}°C`}
                          maxLabel={`${stats.max}°C`}
                        />
                      </div>
                    ) : (
                      <div className={styles.filePreviewTable__description}>
                        {column.description || "Column description"}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={styles.filePreviewTable__tbody}>
            {sortedRows.map((row) => (
              <tr key={row.id} className={styles.filePreviewTable__tr}>
                {visibleColumns.map((column) => {
                  const cell = row.cells.find((c) => c.columnId === column.id);
                  return (
                    <td key={column.id} className={styles.filePreviewTable__td}>
                      {cell?.value?.toString() ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMoreRows && (
        <div className={styles.filePreviewTable__footer}>
          <button
            type="button"
            onClick={onLoadMore}
            className={styles.filePreviewTable__loadMore}
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
