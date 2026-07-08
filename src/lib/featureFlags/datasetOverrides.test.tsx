import { beforeEach, describe, expect, it } from "vitest";
import {
  DATASET_OVERRIDES_STORAGE_KEY,
  parseDatasetOverrides,
  readDatasetOverrides,
  writeDatasetOverrides,
} from "./datasetOverrides";

describe("parseDatasetOverrides", () => {
  it("returns empty object for null", () => {
    expect(parseDatasetOverrides(null)).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseDatasetOverrides("not json")).toEqual({});
  });

  it("keeps only known flag IDs with string values", () => {
    const raw = JSON.stringify({
      pinnedDatasetWeather: "3166e649-54c1-4ebf-904e-de9a46cb1b18",
      pinnedDatasetLanguage: "d84d1a2e-127d-4393-91d0-afb7e4fd9c68",
      unknownFlag: "some-id",
      pinnedDatasetMath: 123,
    });
    expect(parseDatasetOverrides(raw)).toEqual({
      pinnedDatasetWeather: "3166e649-54c1-4ebf-904e-de9a46cb1b18",
      pinnedDatasetLanguage: "d84d1a2e-127d-4393-91d0-afb7e4fd9c68",
    });
  });
});

describe("readDatasetOverrides / writeDatasetOverrides", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns empty object when nothing stored", () => {
    expect(readDatasetOverrides()).toEqual({});
  });

  it("round-trips a valid override", () => {
    writeDatasetOverrides({ pinnedDatasetWeather: "abc-123" });
    expect(
      JSON.parse(
        window.localStorage.getItem(DATASET_OVERRIDES_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({ pinnedDatasetWeather: "abc-123" });
    expect(readDatasetOverrides()).toEqual({ pinnedDatasetWeather: "abc-123" });
  });
});
