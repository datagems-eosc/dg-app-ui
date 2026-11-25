/**
 * Column recognition for temperature answers. Only the column name is used
 * (the service returns no units); a name must name a mean temperature and say
 * Celsius explicitly to be supported.
 */

const TIME_COLUMN = /^(time|timestamp|date|day)$/i;

const TEMPERATURE_TOKENS = new Set([
  "tmean",
  "tavg",
  "tmin",
  "tmax",
  "temp",
  "temperature",
  "t2m",
]);
const MEAN_TEMPERATURE_TOKENS = new Set(["tmean", "tavg"]);
const MEAN_TOKENS = new Set(["avg", "average", "mean"]);
const OTHER_AGGREGATE_TOKENS = new Set([
  "min",
  "max",
  "sum",
  "count",
  "std",
  "stddev",
  "var",
  "variance",
  "median",
  "tmin",
  "tmax",
]);
const CELSIUS_TOKENS = new Set(["celsius", "degc"]);
const OTHER_UNIT_TOKENS = new Set(["kelvin", "fahrenheit", "degk", "degf"]);

function tokens(name: string): string[] {
  return (
    name
      // "stationCount" → station_count, while "degC" and "T2M" stay whole.
      .replace(/([a-z0-9])([A-Z][a-z])/g, "$1_$2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

export function isTimeColumnName(name: string): boolean {
  return TIME_COLUMN.test(name);
}

/** Any temperature-like column, whatever its unit or aggregate. */
export function isTemperatureColumn(name: string): boolean {
  return tokens(name).some((token) => TEMPERATURE_TOKENS.has(token));
}

function isSupportedTemperature(name: string): boolean {
  const parts = tokens(name);
  const meanTemperature =
    parts.some((token) => MEAN_TEMPERATURE_TOKENS.has(token)) ||
    (parts.some((token) => TEMPERATURE_TOKENS.has(token)) &&
      parts.some((token) => MEAN_TOKENS.has(token)));
  return (
    meanTemperature &&
    !parts.some((token) => OTHER_AGGREGATE_TOKENS.has(token)) &&
    !parts.some((token) => OTHER_UNIT_TOKENS.has(token)) &&
    parts.some((token) => CELSIUS_TOKENS.has(token))
  );
}

/**
 * The single supported temperature column, or null when there is none, it is
 * not a mean Celsius temperature, or another temperature column makes the
 * answer ambiguous.
 */
export function supportedTemperatureColumn(names: string[]): string | null {
  const temperatures = names.filter(isTemperatureColumn);
  if (temperatures.length !== 1) return null;
  return isSupportedTemperature(temperatures[0]) ? temperatures[0] : null;
}

/** "avg_tmean_celsius" → "Avg tmean (°C)", "grid_cells" → "Grid cells". */
export function columnLabel(name: string): string {
  const parts = tokens(name);
  const celsius = parts.some((token) => CELSIUS_TOKENS.has(token));
  const words = parts.filter((token) => !CELSIUS_TOKENS.has(token)).join(" ");
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return celsius ? `${label} (°C)` : label;
}
