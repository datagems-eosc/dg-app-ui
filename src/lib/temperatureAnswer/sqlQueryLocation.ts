/**
 * TEMPORARY location reader for temperature answers.
 *
 * The in-data exploration response has no structured query location yet
 * (`InputParams` has been null in every observed answer), so this reads the
 * one coordinate predicate the service is known to generate:
 *
 *   (ROUND(CAST(<alias>.latitude AS DECIMAL), n),
 *    ROUND(CAST(<alias>.longitude AS DECIMAL), n)) IN ((<lat>, <lon>))
 *
 * Anything else — several pairs or predicates, other spatial conditions,
 * unfamiliar SQL, out-of-range values — yields no location. The SQL is never
 * executed or logged. Replace through `resolveQueryLocation` once the service
 * returns a structured location.
 */

export interface QueryLocation {
  latitude: number;
  longitude: number;
  source: "sql";
}

const NUMBER = String.raw`[+-]?\d+(?:\.\d+)?`;
const CAST_TYPE = String.raw`(?:DECIMAL|NUMERIC)(?:\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\))?`;
const rounded = (column: string) =>
  String.raw`ROUND\s*\(\s*CAST\s*\(\s*(?:[A-Za-z_]\w*\s*\.\s*)?${column}\s+AS\s+${CAST_TYPE}\s*\)\s*,\s*\d+\s*\)`;

const PREDICATE = new RegExp(
  String.raw`\(\s*${rounded("latitude")}\s*,\s*${rounded("longitude")}\s*\)\s*IN\s*\(\s*\(\s*(${NUMBER})\s*,\s*(${NUMBER})\s*\)\s*\)`,
  "gi",
);

const count = (sql: string, word: string) =>
  sql.match(new RegExp(String.raw`\b${word}\b`, "gi"))?.length ?? 0;

export function extractQueryLocationFromSql(
  sql: string | undefined,
): QueryLocation | null {
  if (!sql) return null;
  // Exactly one latitude and one longitude reference: any other spatial
  // condition would make the single pair an incomplete description.
  if (count(sql, "latitude") !== 1 || count(sql, "longitude") !== 1) {
    return null;
  }
  const matches = [...sql.matchAll(PREDICATE)];
  if (matches.length !== 1) return null;

  const latitude = Number(matches[0][1]);
  const longitude = Number(matches[0][2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { latitude, longitude, source: "sql" };
}
