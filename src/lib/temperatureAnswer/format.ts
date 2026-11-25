/**
 * Display formatting for temperature answers. Display only: the table and
 * chart use these, the CSV never does. Months are spelled out by hand and all
 * parts are read in UTC, so output never depends on the viewer's locale or
 * time zone.
 */
import type { TemperatureAnswer } from "./interpret";
import type { TimeValue } from "./timeValue";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** One decimal place; "-0.0" reads as "0.0". */
export function formatTemperature(value: number): string {
  const shown = value.toFixed(1);
  return shown === "-0.0" ? "0.0" : shown;
}

function formatDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "1 Jul 2020", "Jul 2020", "1 Jul 2020, 11:00" (UTC), or a zone-less timestamp as returned. */
export function formatTime(time: TimeValue): string {
  const date = new Date(time.epochMs);
  if (time.kind === "month") {
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  if (time.kind === "date") return formatDay(date);
  // Without a zone the time is not converted or reformatted at all.
  if (!time.hasZone) return time.raw;
  const seconds = date.getUTCSeconds();
  const clock = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}${
    seconds ? `:${pad(seconds)}` : ""
  }`;
  return `${formatDay(date)}, ${clock}`;
}

/** Month ticks on a long daily axis: "Jul", and "Jan 2020" when a year starts. */
export function formatAxisMonth(time: TimeValue): string {
  const date = new Date(time.epochMs);
  const month = MONTHS[date.getUTCMonth()];
  return date.getUTCMonth() === 0 ? `${month} ${date.getUTCFullYear()}` : month;
}

/** Clock ticks for a series within one day: "14:00". */
export function formatAxisClock(time: TimeValue): string {
  const date = new Date(time.epochMs);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** Short axis label: "1 Jul", or "Jul 2020" for months. */
export function formatAxisTime(time: TimeValue): string {
  const date = new Date(time.epochMs);
  if (time.kind === "month") {
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function formatRangeEnd(time: TimeValue): string {
  return time.kind === "datetime"
    ? formatDay(new Date(time.epochMs))
    : formatTime(time);
}

export function formatDateRange(
  range: NonNullable<TemperatureAnswer["dateRange"]>,
  separator = " – ",
): string {
  const first = formatRangeEnd(range.first);
  const last = formatRangeEnd(range.last);
  return first === last ? first : `${first}${separator}${last}`;
}

const rows = (n: number) => `${n} ${n === 1 ? "row" : "rows"}`;

/** The note under the chart, or null when every row is plotted. */
export function notPlottedNote(
  notPlotted: TemperatureAnswer["notPlotted"],
): string | null {
  const parts: string[] = [];
  if (notPlotted.noValue > 0) {
    parts.push(
      `${rows(notPlotted.noValue)} with no value (shown as ${
        notPlotted.noValue === 1 ? "a gap" : "gaps"
      })`,
    );
  }
  if (notPlotted.unreadableTime > 0) {
    parts.push(
      `${rows(notPlotted.unreadableTime)} with a date that couldn't be read`,
    );
  }
  if (notPlotted.duplicateTime > 0) {
    parts.push(
      `${rows(notPlotted.duplicateTime)} that share a time with another row`,
    );
  }
  if (parts.length === 0) return null;
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Not plotted: ${list}.`;
}
