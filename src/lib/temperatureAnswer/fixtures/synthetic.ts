/**
 * Synthetic temperature answers: hand-made variations of the observed answers
 * (`observed.ts`) for edge cases no recorded response covers. Not captures.
 *
 * The Gateway builds each row's cells from that row's own keys, so a cell can
 * be missing, reordered or `null` even though `TableData` types values as
 * `string | number`.
 */
import type { TableData } from "@/types/chat";

const MISSING = Symbol("missing");

/** Builds a table; `MISSING` leaves the cell out of its row. */
export function table(
  columns: string[],
  rows: unknown[][],
  options: { reverseCells?: boolean } = {},
): TableData {
  return {
    columns: columns.map((name, columnNumber) => ({ columnNumber, name })),
    rows: rows.map((values, rowNumber) => {
      const cells = columns
        .map((column, index) => ({ column, value: values[index] }))
        .filter((cell) => cell.value !== MISSING);
      return {
        rowNumber,
        cells: (options.reverseCells ? cells.reverse() : cells) as Array<{
          column: string;
          value: string | number;
        }>,
      };
    }),
  };
}

export { MISSING };

const day = (n: number) => `2020-07-${String(n).padStart(2, "0")}`;

/** 8–10 July null, 15 July missing, 16 July in an ambiguous format. */
export const missingValuesTable = table(
  ["day", "avg_tmean_celsius"],
  Array.from({ length: 31 }, (_, index) => {
    const n = index + 1;
    if (n >= 8 && n <= 10) return [day(n), null];
    if (n === 15) return [day(n), MISSING];
    if (n === 16) return ["07/16/2020", 25.956838742818604];
    return [day(n), 20 + n / 10];
  }),
);

export const allNullTable = table(
  ["day", "avg_tmean_celsius"],
  Array.from({ length: 7 }, (_, index) => [day(index + 1), null]),
);

export const kelvinTable = table(
  ["day", "avg_tmean_kelvin"],
  [
    [day(1), 303.09],
    [day(2), 302.29],
  ],
);

export const twoTemperatureColumnsTable = table(
  ["day", "avg_tmean_celsius", "max_tmean_celsius"],
  [
    [day(1), 29.9, 33.1],
    [day(2), 29.1, 32.4],
  ],
);

export const extraColumnTable = table(
  ["time", "avg_tmean_celsius", "grid_cells"],
  [
    ["2020-07-01T11:00:00Z", 29.9, 4],
    ["2020-07-02T11:00:00Z", 29.1, 5],
    ["2020-07-03T11:00:00Z", 29.0, 6],
  ],
);

export const reorderedCellsTable = table(
  ["day", "avg_tmean_celsius"],
  [
    [day(2), 29.1],
    [day(1), 29.9],
  ],
  { reverseCells: true },
);

/** One leap year of days, for long-series behaviour. */
export const leapYearTable = table(
  ["day", "avg_tmean_celsius"],
  Array.from({ length: 366 }, (_, index) => {
    const date = new Date(Date.UTC(2020, 0, 1 + index));
    return [date.toISOString().slice(0, 10), 10 + (index % 20) / 2];
  }),
);
