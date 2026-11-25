import { describe, expect, it } from "vitest";
import {
  formatAxisTime,
  formatDateRange,
  formatTemperature,
  formatTime,
  notPlottedNote,
} from "./format";
import { parseTimeValue, type TimeValue } from "./timeValue";

const time = (raw: string) => parseTimeValue(raw) as TimeValue;

describe("formatTemperature", () => {
  it.each([
    [29.940360150795584, "29.9"],
    [30.96, "31.0"],
    [0, "0.0"],
    [-3.2045, "-3.2"],
    [-0.04, "0.0"],
  ])("shows %s as %s", (value, shown) => {
    expect(formatTemperature(value)).toBe(shown);
  });
});

describe("formatTime", () => {
  it("shows a date", () => {
    expect(formatTime(time("2020-07-01"))).toBe("1 Jul 2020");
  });

  it("shows a month", () => {
    expect(formatTime(time("2020-07"))).toBe("Jul 2020");
  });

  it("shows a UTC timestamp without seconds when they are zero", () => {
    expect(formatTime(time("2020-07-01T11:00:00Z"))).toBe("1 Jul 2020, 11:00");
    expect(formatTime(time("2020-07-01T14:00:00+03:00"))).toBe(
      "1 Jul 2020, 11:00",
    );
  });

  it("keeps seconds when present", () => {
    expect(formatTime(time("2020-07-01T11:00:30Z"))).toBe(
      "1 Jul 2020, 11:00:30",
    );
  });

  it("shows a zone-less timestamp as its wall-clock time", () => {
    expect(formatTime(time("2020-07-01 09:05"))).toBe("1 Jul 2020, 09:05");
  });
});

describe("formatAxisTime", () => {
  it("drops the year for days and keeps it for months", () => {
    expect(formatAxisTime(time("2020-07-01"))).toBe("1 Jul");
    expect(formatAxisTime(time("2020-07"))).toBe("Jul 2020");
  });
});

describe("formatDateRange", () => {
  it("joins two dates", () => {
    expect(
      formatDateRange({ first: time("2020-07-01"), last: time("2020-07-31") }),
    ).toBe("1 Jul 2020 – 31 Jul 2020");
  });

  it("uses the dates only for timestamps", () => {
    expect(
      formatDateRange({
        first: time("2020-07-01T11:00:00Z"),
        last: time("2020-07-31T11:00:00Z"),
      }),
    ).toBe("1 Jul 2020 – 31 Jul 2020");
  });

  it("shows one date once", () => {
    expect(
      formatDateRange({ first: time("2020-07-01"), last: time("2020-07-01") }),
    ).toBe("1 Jul 2020");
  });
});

describe("notPlottedNote", () => {
  it("is empty when everything is plotted", () => {
    expect(
      notPlottedNote({ noValue: 0, unreadableTime: 0, duplicateTime: 0 }),
    ).toBeNull();
  });

  it("names each reason with the right number", () => {
    expect(
      notPlottedNote({ noValue: 4, unreadableTime: 1, duplicateTime: 0 }),
    ).toBe(
      "Not plotted: 4 rows with no value (shown as gaps) and 1 row with a date that couldn't be read.",
    );
    expect(
      notPlottedNote({ noValue: 1, unreadableTime: 0, duplicateTime: 2 }),
    ).toBe(
      "Not plotted: 1 row with no value (shown as a gap) and 2 rows that share a time with another row.",
    );
  });

  it("lists three reasons", () => {
    expect(
      notPlottedNote({ noValue: 1, unreadableTime: 1, duplicateTime: 2 }),
    ).toBe(
      "Not plotted: 1 row with no value (shown as a gap), 1 row with a date that couldn't be read and 2 rows that share a time with another row.",
    );
  });
});
