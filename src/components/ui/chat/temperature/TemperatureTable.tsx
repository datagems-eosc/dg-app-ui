"use client";

import { formatTemperature, formatTime } from "@/lib/temperatureAnswer/format";
import type {
  TemperatureAnswer,
  TemperatureRow,
} from "@/lib/temperatureAnswer/interpret";
import { columnLabel } from "@/lib/temperatureAnswer/temperatureColumn";

interface TemperatureTableProps {
  answer: TemperatureAnswer;
}

function MissingCell() {
  return (
    <span className="text-slate-400" aria-label="No value">
      —
    </span>
  );
}

function rawText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function TimeCell({ row, raw }: { row: TemperatureRow; raw: unknown }) {
  const time = row.time;
  if (!time || time.status === "missing") return <MissingCell />;
  if (time.status === "unrecognised") {
    return (
      <>
        {rawText(raw)}
        <span className="text-descriptions-12-regular text-gray-650">
          {" "}
          · date not recognised
        </span>
      </>
    );
  }
  const shown = time.value ? formatTime(time.value) : "";
  return time.status === "duplicate" ? (
    <>
      {shown}
      <span className="text-descriptions-12-regular text-gray-650">
        {" "}
        · same time as another row
      </span>
    </>
  ) : (
    shown
  );
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <MissingCell />;
  }
  return typeof value === "number" ? String(value) : rawText(value);
}

function heading(answer: TemperatureAnswer, column: string): string {
  const label = columnLabel(column);
  return column === answer.timeColumn && answer.timeHasZone
    ? `${label} (UTC)`
    : label;
}

/** The returned rows in returned order; cells bound by column name. */
export function TemperatureTable({ answer }: TemperatureTableProps) {
  const numeric = (column: string) =>
    column === answer.temperatureColumn ||
    answer.rows.some((row) => typeof row.cells[column] === "number");

  return (
    <section
      tabIndex={0}
      aria-label={`${columnLabel(answer.temperatureColumn)} values`}
      className="max-h-80 overflow-auto focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {answer.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className={`sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-75 px-3.5 py-2 align-top text-body-14-medium text-gray-650 [&+th]:border-l ${
                  numeric(column) ? "text-right" : "text-left"
                }`}
              >
                {heading(answer, column)}
                <code className="block font-mono text-xs font-normal text-slate-400">
                  {column}
                </code>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {answer.rows.map((row) => (
            <tr key={row.rowNumber}>
              {answer.columns.map((column) => (
                <td
                  key={column}
                  className={`whitespace-nowrap border-b border-slate-200 px-3.5 py-2 text-body-14-regular text-slate-850 tabular-nums [&+td]:border-l ${
                    numeric(column) ? "text-right" : "text-left"
                  }`}
                >
                  {column === answer.timeColumn ? (
                    <TimeCell row={row} raw={row.cells[column]} />
                  ) : column === answer.temperatureColumn &&
                    row.temperature !== null ? (
                    formatTemperature(row.temperature)
                  ) : (
                    <Cell value={row.cells[column]} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
