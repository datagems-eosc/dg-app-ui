import { describe, expect, it } from "vitest";
import {
  columnLabel,
  isTemperatureColumn,
  isTimeColumnName,
  supportedTemperatureColumn,
} from "./temperatureColumn";

describe("isTimeColumnName", () => {
  it.each(["time", "timestamp", "date", "day", "Day", "TIME"])(
    "accepts %s",
    (name) => {
      expect(isTimeColumnName(name)).toBe(true);
    },
  );

  it.each(["datetime", "day_of_year", "month", "date_from", "when"])(
    "rejects %s",
    (name) => {
      expect(isTimeColumnName(name)).toBe(false);
    },
  );
});

describe("isTemperatureColumn", () => {
  it.each([
    "avg_tmean_celsius",
    "avg_tmean_kelvin",
    "max_tmean_celsius",
    "tmin",
    "temperature_c",
    "mean_temperature",
    "t2m",
  ])("counts %s as a temperature column", (name) => {
    expect(isTemperatureColumn(name)).toBe(true);
  });

  it.each(["day", "grid_cells", "latitude", "attempts", "template_id"])(
    "does not count %s",
    (name) => {
      expect(isTemperatureColumn(name)).toBe(false);
    },
  );
});

describe("supportedTemperatureColumn", () => {
  it.each([
    "avg_tmean_celsius",
    "AVG_TMEAN_CELSIUS",
    "tmean_celsius",
    "mean_temperature_celsius",
    "average_temp_celsius",
    "avg_temperature_degc",
    "avg_tmean_degC",
  ])("supports %s", (name) => {
    expect(supportedTemperatureColumn([name])).toBe(name);
  });

  it.each([
    ["Kelvin", "avg_tmean_kelvin"],
    ["Celsius and Kelvin", "avg_tmean_celsius_from_kelvin"],
    ["Celsius and Fahrenheit", "avg_temp_degc_degf"],
    ["Fahrenheit", "avg_temp_fahrenheit"],
    ["no unit", "avg_tmean"],
    ["a bare _c suffix", "avg_temp_c"],
    ["a maximum", "max_tmean_celsius"],
    ["a minimum", "tmin_celsius"],
    ["a sum", "sum_tmean_celsius"],
  ])("does not support a column with %s", (_label, name) => {
    expect(supportedTemperatureColumn([name])).toBeNull();
  });

  it("picks the one temperature column among others", () => {
    expect(
      supportedTemperatureColumn(["day", "avg_tmean_celsius", "grid_cells"]),
    ).toBe("avg_tmean_celsius");
  });

  it("counts an upper-case T2M column as temperature", () => {
    expect(
      supportedTemperatureColumn(["day", "avg_tmean_celsius", "T2M"]),
    ).toBeNull();
  });

  it("refuses two temperature columns even if only one is supported", () => {
    expect(
      supportedTemperatureColumn([
        "day",
        "avg_tmean_celsius",
        "max_tmean_celsius",
      ]),
    ).toBeNull();
  });
});

describe("columnLabel", () => {
  it("shows the unit for a Celsius column", () => {
    expect(columnLabel("avg_tmean_celsius")).toBe("Avg tmean (°C)");
    expect(columnLabel("avg_temperature_degc")).toBe("Avg temperature (°C)");
    expect(columnLabel("avg_tmean_degC")).toBe("Avg tmean (°C)");
  });

  it("turns other names into words", () => {
    expect(columnLabel("grid_cells")).toBe("Grid cells");
    expect(columnLabel("day")).toBe("Day");
    expect(columnLabel("stationCount")).toBe("Station count");
  });
});
