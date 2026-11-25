import { describe, expect, it } from "vitest";
import {
  athensDaySql,
  athensTimeSql,
  zurichSingleSql,
} from "./fixtures/observed";
import { resolveQueryLocation } from "./queryLocation";
import { extractQueryLocationFromSql } from "./sqlQueryLocation";

const predicate = (pair: string, alias = "tm.") =>
  `SELECT 1 FROM meteo_tmean AS tm WHERE (ROUND(CAST(${alias}latitude AS DECIMAL), 1), ROUND(CAST(${alias}longitude AS DECIMAL), 1)) IN (${pair})`;

describe("extractQueryLocationFromSql", () => {
  it("reads the saved Athens SQL (alias tm)", () => {
    expect(extractQueryLocationFromSql(athensTimeSql)).toEqual({
      latitude: 38,
      longitude: 23.7,
      source: "sql",
    });
  });

  it("reads the observed Athens and Zurich SQL (alias mt)", () => {
    expect(extractQueryLocationFromSql(athensDaySql)).toMatchObject({
      latitude: 38,
      longitude: 23.7,
    });
    expect(extractQueryLocationFromSql(zurichSingleSql)).toMatchObject({
      latitude: 47.4,
      longitude: 8.5,
    });
  });

  it("accepts no alias, other spacing, case, rounding and NUMERIC", () => {
    expect(
      extractQueryLocationFromSql(
        "select * from t where ( round( cast(latitude as numeric) ,2 ),round(cast(longitude as numeric(9,4)),2) ) in ( ( -33.87 , 151.21 ) )",
      ),
    ).toMatchObject({ latitude: -33.87, longitude: 151.21 });
  });

  it("keeps zero coordinates", () => {
    expect(extractQueryLocationFromSql(predicate("(0.0, 0.0)"))).toMatchObject({
      latitude: 0,
      longitude: 0,
    });
  });

  it.each([
    ["several pairs", predicate("(38.0, 23.7), (47.4, 8.5)")],
    [
      "two predicates",
      `${predicate("(38.0, 23.7)")} OR ${predicate("(47.4, 8.5)").split("WHERE ")[1]}`,
    ],
    [
      "another spatial condition",
      `${predicate("(38.0, 23.7)")} OR tm.latitude > 40`,
    ],
    ["latitude out of range", predicate("(91.0, 23.7)")],
    ["longitude out of range", predicate("(38.0, -180.5)")],
    ["a non-numeric value", predicate("(lat, 23.7)")],
    [
      "an equality filter",
      "SELECT 1 FROM t WHERE latitude = 38.0 AND longitude = 23.7",
    ],
    [
      "swapped columns",
      "SELECT 1 FROM t WHERE (ROUND(CAST(longitude AS DECIMAL), 1), ROUND(CAST(latitude AS DECIMAL), 1)) IN ((23.7, 38.0))",
    ],
    ["no location", "SELECT AVG(tmean) FROM meteo_tmean"],
    ["an empty string", ""],
  ])("returns no location for %s", (_label, sql) => {
    expect(extractQueryLocationFromSql(sql)).toBeNull();
  });

  it("returns no location without SQL", () => {
    expect(extractQueryLocationFromSql(undefined)).toBeNull();
  });
});

describe("resolveQueryLocation", () => {
  it("uses the SQL of the message", () => {
    expect(resolveQueryLocation({ sqlQuery: athensDaySql })).toMatchObject({
      latitude: 38,
      longitude: 23.7,
    });
  });

  it("ignores InputParams coordinates on the message", () => {
    expect(
      resolveQueryLocation({
        sqlQuery: "SELECT 1",
        latitude: 38,
        longitude: 23.7,
      }),
    ).toBeNull();
  });
});
