/**
 * Strict reading of time cells in a temperature answer. Only unambiguous ISO
 * forms are accepted; anything else is left out of the chart rather than
 * guessed. Parsing never uses local-time `Date` APIs, so a value cannot shift
 * with the viewer's time zone.
 */

export interface TimeValue {
  kind: "date" | "month" | "datetime";
  /** UTC milliseconds; for zone-less values, the wall-clock time read as UTC. */
  epochMs: number;
  hasZone: boolean;
}

export type TimeStatus = "ok" | "missing" | "unrecognised" | "duplicate";

export interface ParsedTime {
  status: TimeStatus;
  value: TimeValue | null;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/;

const MAX_OFFSET_MINUTES = 14 * 60;

function utcDate(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const epochMs = Date.UTC(year, month - 1, day);
  // Date.UTC rolls 2020-02-30 over to 1 March; a real date round-trips.
  return new Date(epochMs).getUTCDate() === day ? epochMs : null;
}

function offsetMinutes(zone: string): number | null {
  if (zone === "Z") return 0;
  const digits = zone.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (minutes > 59) return null;
  const total = hours * 60 + minutes;
  if (total > MAX_OFFSET_MINUTES) return null;
  return zone.startsWith("-") ? -total : total;
}

export function parseTimeValue(raw: unknown): TimeValue | null {
  if (typeof raw !== "string") return null;

  const date = DATE.exec(raw);
  if (date) {
    const epochMs = utcDate(Number(date[1]), Number(date[2]), Number(date[3]));
    return epochMs === null ? null : { kind: "date", epochMs, hasZone: false };
  }

  const month = MONTH.exec(raw);
  if (month) {
    const epochMs = utcDate(Number(month[1]), Number(month[2]), 1);
    return epochMs === null ? null : { kind: "month", epochMs, hasZone: false };
  }

  const datetime = DATETIME.exec(raw);
  if (!datetime) return null;
  const [, y, mo, d, h, mi, s = "0", fraction = "", zone] = datetime;
  const day = utcDate(Number(y), Number(mo), Number(d));
  const hours = Number(h);
  const minutes = Number(mi);
  const seconds = Number(s);
  if (day === null || hours > 23 || minutes > 59 || seconds > 59) return null;
  const offset = zone === undefined ? 0 : offsetMinutes(zone);
  if (offset === null) return null;
  const millis = fraction ? Math.round(Number(fraction) * 1000) : 0;
  return {
    kind: "datetime",
    epochMs:
      day + ((hours * 60 + minutes - offset) * 60 + seconds) * 1000 + millis,
    hasZone: zone !== undefined,
  };
}

/**
 * Reads a whole time column. Zone-less timestamps count only when no value in
 * the column has a zone; values sharing a timestamp are all marked duplicate.
 */
export function parseTimeColumn(raws: unknown[]): ParsedTime[] {
  const values = raws.map(parseTimeValue);
  const columnHasZone = values.some(
    (value) => value?.kind === "datetime" && value.hasZone,
  );

  const parsed: ParsedTime[] = raws.map((raw, index) => {
    const value = values[index];
    if (raw === undefined || raw === null || raw === "") {
      return { status: "missing", value: null };
    }
    if (
      !value ||
      (columnHasZone && value.kind === "datetime" && !value.hasZone)
    ) {
      return { status: "unrecognised", value: null };
    }
    return { status: "ok", value };
  });

  const counts = new Map<number, number>();
  for (const entry of parsed) {
    if (entry.value) {
      counts.set(
        entry.value.epochMs,
        (counts.get(entry.value.epochMs) ?? 0) + 1,
      );
    }
  }
  return parsed.map((entry) =>
    entry.value && (counts.get(entry.value.epochMs) ?? 0) > 1
      ? { status: "duplicate", value: entry.value }
      : entry,
  );
}
