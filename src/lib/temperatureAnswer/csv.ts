/**
 * CSV of the returned table, built from the raw cells (never from display
 * values): original column names and order, unrounded numbers, timestamps as
 * returned. Text that a spreadsheet would run as a formula is prefixed with an
 * apostrophe; numbers are never prefixed, so negative temperatures stay
 * numeric.
 */
import type { TableData } from "@/types/chat";
import { cellsByColumn, type TemperatureAnswer } from "./interpret";

const BOM = String.fromCharCode(0xfeff);
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

// Excel in semicolon-separator locales (Greek, most of the EU) splits a
// double-clicked CSV at every ";", so a formula after one would start a cell.
const FORMULA_AFTER_SEMICOLON = /;(\s*)(?=[=+\-@\t\r])/g;

function textField(text: string): string {
  const guarded = text.replace(FORMULA_AFTER_SEMICOLON, ";$1'");
  const safe = FORMULA_START.test(guarded) ? `'${guarded}` : guarded;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function field(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "string") return textField(value);
  if (typeof value === "boolean") return String(value);
  return textField(JSON.stringify(value));
}

export function tableToCsv(tableData: TableData): string {
  const columns = [...tableData.columns]
    .sort((a, b) => a.columnNumber - b.columnNumber)
    .map((column) => column.name);
  const lines = [columns.map(textField).join(",")];
  for (const row of tableData.rows) {
    const cells = cellsByColumn(row);
    lines.push(columns.map((column) => field(cells[column])).join(","));
  }
  // The BOM lets spreadsheets read "°" and accents as UTF-8.
  return BOM + lines.join("\r\n");
}

const isoDay = (epochMs: number) =>
  new Date(epochMs).toISOString().slice(0, 10);

export function csvFileName(answer: TemperatureAnswer | null): string {
  const range = answer?.dateRange;
  if (!range) return "temperature.csv";
  const first = isoDay(range.first.epochMs);
  const last = isoDay(range.last.epochMs);
  return first === last
    ? `temperature-${first}.csv`
    : `temperature-${first}-to-${last}.csv`;
}
