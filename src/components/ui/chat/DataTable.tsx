"use client";

import React, { useState } from "react";
import { TableData } from "@/types/chat";
import { Button } from "../Button";

interface DataTableProps {
  tableData: TableData;
}

// Function to format column names
function formatColumnName(name: string): string {
  // If no underscore, just capitalize first letter
  if (!name.includes("_")) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // Split by underscore and format each word
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Function to detect and format dates
function formatCellValue(value: string | number): string {
  if (typeof value === "number") {
    return value.toString();
  }

  // Check if it's a date string (ISO format or similar)
  const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (dateRegex.test(value)) {
    try {
      const date = new Date(value);
      // Check if it's a valid date
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    } catch (e) {
      // If parsing fails, return original value
    }
  }

  return value;
}

export function DataTable({ tableData }: DataTableProps) {
  const [showAllRows, setShowAllRows] = useState(false);
  const defaultRowCount = 20;

  const displayedRows = showAllRows
    ? tableData.rows
    : tableData.rows.slice(0, defaultRowCount);

  const hasMoreRows = tableData.rows.length > defaultRowCount;

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full bg-white">
          <thead className="bg-slate-75">
            <tr>
              {tableData.columns.map((column, index) => (
                <th
                  key={index}
                  className="px-2 py-2.25 text-body-14-medium text-left text-gray-650 border-b border-slate-200 border-r border-slate-200 last:border-r-0"
                >
                  {formatColumnName(column.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-3 py-3.25 text-body-14-regular text-slate-850 border-r border-slate-200 last:border-r-0 ${
                      rowIndex === displayedRows.length - 1
                        ? ""
                        : "border-b border-slate-200"
                    }`}
                  >
                    {formatCellValue(cell.value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMoreRows && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAllRows(!showAllRows)}
          >
            {showAllRows
              ? `Show less (${defaultRowCount} rows)`
              : `Show more (${tableData.rows.length - defaultRowCount} more rows)`}
          </Button>
        </div>
      )}
    </div>
  );
}
