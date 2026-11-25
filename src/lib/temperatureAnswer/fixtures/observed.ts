/**
 * Temperature answers as the in-data exploration service returned them.
 *
 * - `athensTimeResponse`: a full response for "average temperature in Athens in
 *   July 2020, each day", supplied on 24 November 2026. Only `result` is kept
 *   (the conversation id is left out); every row, value and the SQL are
 *   unchanged.
 * - `athensDayTable` / `zurichSingleTable`: the two answers in a dev
 *   conversation read on 25 November 2026 (a `day` series and a lone value).
 *
 * Not a contract: column names and SQL are what the service produced then.
 */

import type { TableData } from "@/types/chat";
import athensTime from "./athens-july-2020-time.json";

export const athensTimeResponse = athensTime;

export const athensTimeTable = athensTime.result.entries[0].result
  .table as TableData;

export const athensTimeSql = athensTime.result.entries[0].process.sql.query;

const ATHENS_DAILY = [
  29.940360150795584, 29.142222088249525, 28.955830564660914,
  29.137442818413888, 28.412188620860775, 26.2483742027905, 26.1611525282907,
  26.198191869516677, 25.12405097396436, 24.882697847266343, 25.274597973785944,
  27.130149487459676, 26.489727329488574, 24.66046179991065, 25.0404137518413,
  25.956838742818604, 26.740638995857864, 27.030979638370866,
  26.971238765425824, 27.609271288479135, 27.432438304561742,
  27.384645606205652, 27.403762685548088, 27.81119543903344, 28.387097454223863,
  28.0274573990946, 28.56273562068236, 28.65951583485338, 29.456459079940544,
  29.910489714323035, 30.908162292505665,
];

export const athensDayTable: TableData = {
  columns: [
    { columnNumber: 0, name: "day" },
    { columnNumber: 1, name: "avg_tmean_celsius" },
  ],
  rows: ATHENS_DAILY.map((value, index) => ({
    rowNumber: index,
    cells: [
      { column: "day", value: `2020-07-${String(index + 1).padStart(2, "0")}` },
      { column: "avg_tmean_celsius", value },
    ],
  })),
};

export const athensDaySql =
  "SELECT DATE(mt.time) AS day, AVG(mt.tmean) - 273.15 AS avg_tmean_celsius FROM meteo_tmean AS mt WHERE EXTRACT(YEAR FROM mt.time) = 2020 AND EXTRACT(MONTH FROM mt.time) = 7 AND (ROUND(CAST(mt.latitude AS DECIMAL), 1), ROUND(CAST(mt.longitude AS DECIMAL), 1)) IN ((38.0, 23.7)) GROUP BY DATE(mt.time) ORDER BY DATE(mt.time)";

export const zurichSingleTable: TableData = {
  columns: [{ columnNumber: 0, name: "avg_tmean_celsius" }],
  rows: [
    {
      rowNumber: 0,
      cells: [{ column: "avg_tmean_celsius", value: 22.24835866292318 }],
    },
  ],
};

export const zurichSingleSql =
  "SELECT AVG(mt.tmean) - 273.15 AS avg_tmean_celsius FROM meteo_tmean AS mt WHERE EXTRACT(YEAR FROM mt.time) = 2019 AND ( (EXTRACT(MONTH FROM mt.time) = 7 AND EXTRACT(DAY FROM mt.time) BETWEEN 19 AND 25) OR (EXTRACT(MONTH FROM mt.time) = 8 AND EXTRACT(DAY FROM mt.time) BETWEEN 1 AND 5) ) AND (ROUND(CAST(mt.latitude AS DECIMAL), 1), ROUND(CAST(mt.longitude AS DECIMAL), 1)) IN ((47.4, 8.5))";
