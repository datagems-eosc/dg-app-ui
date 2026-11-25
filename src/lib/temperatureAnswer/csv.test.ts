import { describe, expect, it } from "vitest";
import { csvFileName, tableToCsv } from "./csv";
import { athensTimeTable, zurichSingleTable } from "./fixtures/observed";
import {
  MISSING,
  missingValuesTable,
  reorderedCellsTable,
  table,
} from "./fixtures/synthetic";
import { interpretTemperatureAnswer } from "./interpret";

const BOM = String.fromCharCode(0xfeff);
const lines = (csv: string) => csv.replace(BOM, "").split("\r\n");

describe("tableToCsv", () => {
  it("exports all 31 reference rows with original values", () => {
    const csv = tableToCsv(athensTimeTable);
    expect(csv.startsWith(BOM)).toBe(true);
    const out = lines(csv);
    expect(out[0]).toBe("time,avg_tmean_celsius");
    expect(out).toHaveLength(32);
    expect(out[1]).toBe("2020-07-01T11:00:00Z,29.940360150795584");
    expect(out[31]).toBe("2020-07-31T11:00:00Z,30.908162292505665");
  });

  it("exports the Zurich single value", () => {
    expect(lines(tableToCsv(zurichSingleTable))).toEqual([
      "avg_tmean_celsius",
      "22.24835866292318",
    ]);
  });

  it("binds cells by column name", () => {
    expect(lines(tableToCsv(reorderedCellsTable))).toEqual([
      "day,avg_tmean_celsius",
      "2020-07-02,29.1",
      "2020-07-01,29.9",
    ]);
  });

  it("writes missing and null cells as empty fields", () => {
    const out = lines(tableToCsv(missingValuesTable));
    expect(out[8]).toBe("2020-07-08,");
    expect(out[15]).toBe("2020-07-15,");
    expect(out[16]).toBe("07/16/2020,25.956838742818604");
  });

  it("quotes commas, quotes and line breaks", () => {
    const out = tableToCsv(
      table(
        ["note", "n"],
        [
          ['a,"b"', 1],
          ["two\nlines", 2],
        ],
      ),
    );
    expect(out).toContain('"a,""b""",1');
    expect(out).toContain('"two\nlines",2');
  });

  it("neutralises formula-like text but keeps negative numbers", () => {
    const out = lines(
      tableToCsv(
        table(
          ["note", "avg_tmean_celsius"],
          [
            ["=cmd()", -3.2045],
            ["+1", 0],
            ["-2", 1],
            ["@SUM(A1)", 2],
            ["\tTab", 3],
          ],
        ),
      ),
    );
    expect(out.slice(1)).toEqual([
      "'=cmd(),-3.2045",
      "'+1,0",
      "'-2,1",
      "'@SUM(A1),2",
      "'\tTab,3",
    ]);
  });

  it("neutralises a formula-like column name", () => {
    expect(lines(tableToCsv(table(["=x"], [[1]])))[0]).toBe("'=x");
  });

  it("keeps column order and fills a column missing from every row", () => {
    expect(
      lines(tableToCsv(table(["day", "extra"], [["2020-07-01", MISSING]]))),
    ).toEqual(["day,extra", "2020-07-01,"]);
  });
});

describe("csvFileName", () => {
  it("names the date range", () => {
    expect(csvFileName(interpretTemperatureAnswer(athensTimeTable))).toBe(
      "temperature-2020-07-01-to-2020-07-31.csv",
    );
  });

  it("names a single date", () => {
    expect(
      csvFileName(
        interpretTemperatureAnswer(
          table(["day", "avg_tmean_celsius"], [["2020-07-01", 29.9]]),
        ),
      ),
    ).toBe("temperature-2020-07-01.csv");
  });

  it("falls back without dates", () => {
    expect(csvFileName(interpretTemperatureAnswer(zurichSingleTable))).toBe(
      "temperature.csv",
    );
  });
});
