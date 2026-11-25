/**
 * The one interpretation of a temperature answer that the chart, table, value
 * card and CSV share. Pure: it reads the returned table and never formats for
 * display, so exports always see the original values.
 */
import type { TableData } from "@/types/chat";
import {
  isTimeColumnName,
  supportedTemperatureColumn,
} from "./temperatureColumn";
import { type ParsedTime, parseTimeColumn, type TimeValue } from "./timeValue";

export interface TemperatureRow {
  rowNumber: number;
  /** Cells by column name; a missing cell has no key. */
  cells: Record<string, unknown>;
  /** Null when the answer has no time column. */
  time: ParsedTime | null;
  /** Finite numeric temperature, or null. */
  temperature: number | null;
}

export interface Observation {
  rowNumber: number;
  time: TimeValue;
  /** Null marks a gap in the line. */
  temperature: number | null;
}

export interface TemperatureAnswer {
  kind: "series" | "single" | "empty";
  /** Every returned column, in returned order. */
  columns: string[];
  timeColumn: string | null;
  temperatureColumn: string;
  /** True when the time values carry a zone (shown in UTC). */
  timeHasZone: boolean;
  /** Every returned row, in returned order. */
  rows: TemperatureRow[];
  /** Rows with a readable, unique time, in time order. */
  observations: Observation[];
  canChart: boolean;
  notPlotted: {
    noValue: number;
    unreadableTime: number;
    duplicateTime: number;
  };
  dateRange: { first: TimeValue; last: TimeValue } | null;
}

const MIN_CHART_POINTS = 2;

/** Cells by column name; a missing cell has no key. */
export function cellsByColumn(
  row: TableData["rows"][number],
): Record<string, unknown> {
  const cells: Record<string, unknown> = {};
  for (const cell of Array.isArray(row?.cells) ? row.cells : []) {
    if (cell && typeof cell.column === "string") {
      cells[cell.column] = cell.value;
    }
  }
  return cells;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function interpretTemperatureAnswer(
  tableData: TableData | undefined,
): TemperatureAnswer | null {
  if (!tableData || !Array.isArray(tableData.columns)) return null;
  if (!Array.isArray(tableData.rows) || tableData.rows.length === 0) {
    return null;
  }

  const columns = [...tableData.columns]
    .sort((a, b) => a.columnNumber - b.columnNumber)
    .map((column) => column.name);
  const temperatureColumn = supportedTemperatureColumn(columns);
  if (!temperatureColumn) return null;

  const timeColumns = columns.filter(isTimeColumnName);
  const timeColumn = isTimeColumnName(columns[0]) ? columns[0] : null;
  if (timeColumns.length > (timeColumn ? 1 : 0)) return null;
  if (!timeColumn && tableData.rows.length !== 1) return null;

  const cellRows = tableData.rows.map(cellsByColumn);
  const times = timeColumn
    ? parseTimeColumn(cellRows.map((cells) => cells[timeColumn]))
    : null;

  const rows: TemperatureRow[] = tableData.rows.map((row, index) => ({
    rowNumber: row.rowNumber,
    cells: cellRows[index],
    time: times ? times[index] : null,
    temperature: finiteNumber(cellRows[index][temperatureColumn]),
  }));

  const notPlotted = { noValue: 0, unreadableTime: 0, duplicateTime: 0 };
  const observations: Observation[] = [];
  for (const row of rows) {
    if (row.time && row.time.status !== "ok") {
      if (row.time.status === "duplicate") notPlotted.duplicateTime += 1;
      else notPlotted.unreadableTime += 1;
      continue;
    }
    if (row.temperature === null) notPlotted.noValue += 1;
    if (row.time?.value) {
      observations.push({
        rowNumber: row.rowNumber,
        time: row.time.value,
        temperature: row.temperature,
      });
    }
  }
  observations.sort((a, b) => a.time.epochMs - b.time.epochMs);

  const plotted = observations.filter((o) => o.temperature !== null).length;
  const hasTemperature = rows.some((row) => row.temperature !== null);
  const kind = !hasTemperature
    ? "empty"
    : rows.length === 1
      ? "single"
      : "series";

  return {
    kind,
    columns,
    timeColumn,
    temperatureColumn,
    timeHasZone: observations.some((o) => o.time.hasZone),
    rows,
    observations,
    canChart: kind === "series" && plotted >= MIN_CHART_POINTS,
    notPlotted,
    dateRange:
      observations.length > 0
        ? {
            first: observations[0].time,
            last: observations[observations.length - 1].time,
          }
        : null,
  };
}
