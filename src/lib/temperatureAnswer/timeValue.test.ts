import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseTimeColumn, parseTimeValue } from "./timeValue";

// West of UTC, midnight-UTC dates fall on the previous local day, so any
// local-time Date API would show or parse the wrong day here.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("parseTimeValue", () => {
  it("reads a calendar date as that UTC day", () => {
    expect(parseTimeValue("2020-07-01")).toEqual({
      kind: "date",
      epochMs: Date.UTC(2020, 6, 1),
      hasZone: false,
      raw: "2020-07-01",
    });
  });

  it("reads a month", () => {
    expect(parseTimeValue("2020-07")).toMatchObject({
      kind: "month",
      epochMs: Date.UTC(2020, 6, 1),
    });
  });

  it("reads a UTC timestamp", () => {
    expect(parseTimeValue("2020-07-01T11:00:00Z")).toEqual({
      kind: "datetime",
      epochMs: Date.UTC(2020, 6, 1, 11),
      hasZone: true,
      raw: "2020-07-01T11:00:00Z",
    });
  });

  it("normalises an offset to UTC", () => {
    expect(parseTimeValue("2020-07-01T14:00:00+03:00")?.epochMs).toBe(
      Date.UTC(2020, 6, 1, 11),
    );
    expect(parseTimeValue("2020-07-01 09:30-0130")?.epochMs).toBe(
      Date.UTC(2020, 6, 1, 11),
    );
  });

  it("reads a timestamp without a zone as wall-clock time", () => {
    expect(parseTimeValue("2020-07-01 11:00:00")).toEqual({
      kind: "datetime",
      epochMs: Date.UTC(2020, 6, 1, 11),
      hasZone: false,
      raw: "2020-07-01 11:00:00",
    });
  });

  it("accepts an hour-only offset", () => {
    expect(parseTimeValue("2020-07-01 11:00:00+00")?.epochMs).toBe(
      Date.UTC(2020, 6, 1, 11),
    );
    expect(parseTimeValue("2020-07-01T13:00:00+02")?.epochMs).toBe(
      Date.UTC(2020, 6, 1, 11),
    );
  });

  it("keeps fractional seconds", () => {
    expect(parseTimeValue("2020-07-01T11:00:00.250Z")?.epochMs).toBe(
      Date.UTC(2020, 6, 1, 11, 0, 0, 250),
    );
  });

  it.each([
    ["slash date", "07/16/2020"],
    ["day-first slash date", "16/07/2020"],
    ["impossible date", "2020-02-30"],
    ["impossible month", "2020-13"],
    ["impossible hour", "2020-07-01T24:00:00Z"],
    ["offset out of range", "2020-07-01T11:00:00+15:00"],
    ["prose", "1st of July"],
    ["empty", ""],
    ["padded", " 2020-07-01"],
  ])("rejects a %s", (_label, raw) => {
    expect(parseTimeValue(raw)).toBeNull();
  });

  it.each([
    ["epoch seconds", 1593601200],
    ["epoch milliseconds", 1593601200000],
    ["null", null],
    ["undefined", undefined],
    ["object", { value: "2020-07-01" }],
  ])("rejects %s", (_label, raw) => {
    expect(parseTimeValue(raw)).toBeNull();
  });

  it("accepts 29 February only in a leap year", () => {
    expect(parseTimeValue("2020-02-29")).not.toBeNull();
    expect(parseTimeValue("2019-02-29")).toBeNull();
  });
});

describe("parseTimeColumn", () => {
  it("marks each value as ok, missing or unrecognised", () => {
    expect(
      parseTimeColumn(["2020-07-01", undefined, "07/16/2020"]).map(
        (entry) => entry.status,
      ),
    ).toEqual(["ok", "missing", "unrecognised"]);
  });

  it("leaves out zone-less timestamps when the column mixes zones", () => {
    const parsed = parseTimeColumn([
      "2020-07-01T11:00:00Z",
      "2020-07-02 11:00:00",
    ]);
    expect(parsed.map((entry) => entry.status)).toEqual(["ok", "unrecognised"]);
  });

  it("accepts zone-less timestamps when no value has a zone", () => {
    const parsed = parseTimeColumn(["2020-07-01 11:00", "2020-07-02 11:00"]);
    expect(parsed.map((entry) => entry.status)).toEqual(["ok", "ok"]);
  });

  it("marks every row that shares a timestamp as a duplicate", () => {
    const parsed = parseTimeColumn([
      "2020-07-01T11:00:00Z",
      "2020-07-01T14:00:00+03:00",
      "2020-07-02T11:00:00Z",
    ]);
    expect(parsed.map((entry) => entry.status)).toEqual([
      "duplicate",
      "duplicate",
      "ok",
    ]);
  });

  it("does not shift dates by the viewer's time zone", () => {
    expect(new Date(2020, 6, 1).getTimezoneOffset()).not.toBe(0);
    const [first] = parseTimeColumn(["2020-07-01"]);
    expect(first.value?.epochMs).toBe(Date.UTC(2020, 6, 1));
  });
});
