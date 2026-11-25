import { describe, expect, it } from "vitest";
import {
  athensDayTable,
  athensTimeTable,
  zurichSingleTable,
} from "./fixtures/observed";
import {
  allNullTable,
  extraColumnTable,
  kelvinTable,
  leapYearTable,
  MISSING,
  missingValuesTable,
  reorderedCellsTable,
  table,
  twoTemperatureColumnsTable,
} from "./fixtures/synthetic";
import { interpretTemperatureAnswer } from "./interpret";

describe("interpretTemperatureAnswer — recognition", () => {
  it("recognises the saved Athens response with UTC timestamps", () => {
    const answer = interpretTemperatureAnswer(athensTimeTable);
    expect(answer).toMatchObject({
      kind: "series",
      timeColumn: "time",
      temperatureColumn: "avg_tmean_celsius",
      timeHasZone: true,
      canChart: true,
    });
    expect(answer?.rows).toHaveLength(31);
    expect(answer?.observations).toHaveLength(31);
  });

  it("recognises the observed Athens daily answer", () => {
    const answer = interpretTemperatureAnswer(athensDayTable);
    expect(answer).toMatchObject({
      kind: "series",
      timeColumn: "day",
      timeHasZone: false,
    });
    expect(answer?.dateRange).toEqual({
      first: { kind: "date", epochMs: Date.UTC(2020, 6, 1), hasZone: false },
      last: { kind: "date", epochMs: Date.UTC(2020, 6, 31), hasZone: false },
    });
  });

  it("recognises the Zurich lone value as a single value", () => {
    expect(interpretTemperatureAnswer(zurichSingleTable)).toMatchObject({
      kind: "single",
      timeColumn: null,
      canChart: false,
      rows: [{ temperature: 22.24835866292318, time: null }],
    });
  });

  it("treats one dated row as a single value with its date", () => {
    const answer = interpretTemperatureAnswer(
      table(["day", "avg_tmean_celsius"], [["2020-07-01", 29.94]]),
    );
    expect(answer?.kind).toBe("single");
    expect(answer?.rows[0].time?.value?.epochMs).toBe(Date.UTC(2020, 6, 1));
  });

  it.each([
    ["no table", undefined],
    ["a Kelvin column", kelvinTable],
    ["two temperature columns", twoTemperatureColumnsTable],
    [
      "a time column that is not first",
      table(
        ["avg_tmean_celsius", "day"],
        [
          [29.9, "2020-07-01"],
          [29.1, "2020-07-02"],
        ],
      ),
    ],
    [
      "several rows without a time column",
      table(["avg_tmean_celsius"], [[29.9], [29.1]]),
    ],
    [
      "a first column that is not a time column",
      table(
        ["station", "avg_tmean_celsius"],
        [
          ["Athens", 29.9],
          ["Patras", 28.1],
        ],
      ),
    ],
    ["no rows", table(["day", "avg_tmean_celsius"], [])],
    [
      "a non-temperature table",
      table(
        ["title", "year"],
        [
          ["Ulysses", 1922],
          ["Dubliners", 1914],
        ],
      ),
    ],
  ])("leaves an answer with %s unrecognised", (_label, tableData) => {
    expect(interpretTemperatureAnswer(tableData)).toBeNull();
  });
});

describe("interpretTemperatureAnswer — rows and observations", () => {
  it("binds cells by column name, not position", () => {
    const answer = interpretTemperatureAnswer(reorderedCellsTable);
    expect(answer?.rows.map((row) => row.cells.day)).toEqual([
      "2020-07-02",
      "2020-07-01",
    ]);
    expect(answer?.rows.map((row) => row.temperature)).toEqual([29.1, 29.9]);
  });

  it("keeps rows in returned order and observations in time order", () => {
    const answer = interpretTemperatureAnswer(reorderedCellsTable);
    expect(answer?.rows.map((row) => row.rowNumber)).toEqual([0, 1]);
    expect(answer?.observations.map((o) => o.temperature)).toEqual([
      29.9, 29.1,
    ]);
  });

  it("counts what is not plotted and keeps gaps in the observations", () => {
    const answer = interpretTemperatureAnswer(missingValuesTable);
    expect(answer?.notPlotted).toEqual({
      noValue: 4,
      unreadableTime: 1,
      duplicateTime: 0,
    });
    expect(answer?.rows).toHaveLength(31);
    // 30 dated rows, four of them gaps; the unreadable 16 July is not placed.
    expect(answer?.observations).toHaveLength(30);
    expect(
      answer?.observations.filter((o) => o.temperature === null),
    ).toHaveLength(4);
    expect(answer?.rows[14].cells).not.toHaveProperty("avg_tmean_celsius");
  });

  it("does not plot numeric strings or non-finite values", () => {
    const answer = interpretTemperatureAnswer(
      table(
        ["day", "avg_tmean_celsius"],
        [
          ["2020-07-01", "29.9"],
          ["2020-07-02", Number.NaN],
          ["2020-07-03", 28.4],
          ["2020-07-04", 28.1],
        ],
      ),
    );
    expect(answer?.rows.map((row) => row.temperature)).toEqual([
      null,
      null,
      28.4,
      28.1,
    ]);
    expect(answer?.notPlotted.noValue).toBe(2);
  });

  it("keeps zero and negative temperatures", () => {
    const answer = interpretTemperatureAnswer(
      table(
        ["day", "avg_tmean_celsius"],
        [
          ["2020-01-01", 0],
          ["2020-01-02", -3.2045],
        ],
      ),
    );
    expect(answer?.observations.map((o) => o.temperature)).toEqual([
      0, -3.2045,
    ]);
  });

  it("counts duplicate timestamps and does not chart them", () => {
    const answer = interpretTemperatureAnswer(
      table(
        ["day", "avg_tmean_celsius"],
        [
          ["2020-07-01", 29.9],
          ["2020-07-01", 29.1],
          ["2020-07-02", 28.9],
        ],
      ),
    );
    expect(answer?.notPlotted.duplicateTime).toBe(2);
    expect(answer?.observations).toHaveLength(1);
    expect(answer?.canChart).toBe(false);
  });

  it("is empty when no row has a temperature", () => {
    expect(interpretTemperatureAnswer(allNullTable)).toMatchObject({
      kind: "empty",
      canChart: false,
    });
  });

  it("keeps extra columns for the table but charts only temperature", () => {
    const answer = interpretTemperatureAnswer(extraColumnTable);
    expect(answer?.columns).toEqual([
      "time",
      "avg_tmean_celsius",
      "grid_cells",
    ]);
    expect(answer?.rows[0].cells.grid_cells).toBe(4);
  });

  it("offers no chart with fewer than two plottable observations", () => {
    const answer = interpretTemperatureAnswer(
      table(
        ["day", "avg_tmean_celsius"],
        [
          ["2020-07-01", 29.9],
          ["2020-07-02", null],
          ["07/03/2020", 28.1],
        ],
      ),
    );
    expect(answer?.kind).toBe("series");
    expect(answer?.canChart).toBe(false);
  });

  it("handles a long series", () => {
    const answer = interpretTemperatureAnswer(leapYearTable);
    expect(answer?.observations).toHaveLength(366);
    expect(answer?.dateRange?.last.epochMs).toBe(Date.UTC(2020, 11, 31));
  });

  it("treats a missing time cell as unreadable", () => {
    const answer = interpretTemperatureAnswer(
      table(
        ["day", "avg_tmean_celsius"],
        [
          [MISSING, 29.9],
          ["2020-07-02", 29.1],
          ["2020-07-03", 28.1],
        ],
      ),
    );
    expect(answer?.notPlotted.unreadableTime).toBe(1);
  });
});
