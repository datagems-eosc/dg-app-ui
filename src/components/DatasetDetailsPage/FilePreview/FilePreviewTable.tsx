"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { FileColumn, FileRow } from "@/types/filePreview";
import styles from "./FilePreviewTable.module.scss";

interface FilePreviewTableProps {
  columns: FileColumn[];
  rows: FileRow[];
  totalRows: number;
  onShowColumnsClick: () => void;
  onLoadMore?: () => void;
}

type SortDirection = "asc" | "desc" | null;

export default function FilePreviewTable({
  columns,
  rows,
  totalRows,
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
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={styles.filePreviewTable__th}
                  onClick={() => handleSort(column.id)}
                >
                  <div className={styles.filePreviewTable__thContent}>
                    <span>{column.name}</span>
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
