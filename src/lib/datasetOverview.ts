/**
 * Pure helpers for the dataset Overview: which metadata values are shown,
 * how codes become names, and how lists and addresses are shortened to fit.
 */

/** Drops blank entries and repeats, whatever their case. */
export function presentValues(
  values: readonly (string | undefined | null)[] | undefined,
): string[] {
  const seen = new Map<string, string>();
  for (const value of values ?? []) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text && !seen.has(text.toLowerCase()))
      seen.set(text.toLowerCase(), text);
  }
  return [...seen.values()];
}

const SHORT_CODE = /^[a-z]{2,3}$/i;

function nameOf(code: string, type: "language" | "region"): string | undefined {
  if (/^none$/i.test(code)) return undefined;
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(["en"], { type }).of(
      type === "region" ? code.toUpperCase() : code.toLowerCase(),
    );
  } catch {
    // Not a code the platform accepts: a written-out name stays, a short
    // unknown code says nothing.
    return SHORT_CODE.test(code) || code.length < 2 ? undefined : code;
  }
  const unnamed =
    !name ||
    name.toLowerCase() === code.toLowerCase() ||
    name.toLowerCase() === "unknown region";
  if (unnamed) return SHORT_CODE.test(code) ? undefined : code;
  return name;
}

/**
 * The dataset mapper joins several language or country codes with commas.
 * Each becomes its English name; names already written out stay, and "None"
 * or a code nobody knows is left out.
 */
export function displayNames(
  codes: string | undefined,
  type: "language" | "region",
): string[] {
  return presentValues(
    presentValues((codes ?? "").split(",")).map((code) => nameOf(code, type)),
  );
}

/** A trimmed http(s) address that parses, or `undefined`. */
export function webUrl(value: string | undefined): string | undefined {
  const url = value?.trim();
  if (!url || !/^https?:\/\/\S+$/i.test(url)) return undefined;
  try {
    return new URL(url).hostname ? url : undefined;
  } catch {
    return undefined;
  }
}

function comparable(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.host.toLowerCase()}${path}${parsed.search}`;
}

/** Two web addresses that lead to the same place, ignoring http/https. */
export function sameAddress(
  first: string | undefined,
  second: string | undefined,
): boolean {
  const a = webUrl(first);
  const b = webUrl(second);
  return !!a && !!b && comparable(a) === comparable(b);
}

/** An address as people read it: no scheme, no www, no trailing slash. */
export function shortUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/$/, "");
}

/** The longest candidate that fits; candidates grow with their index. */
function longest(
  size: number,
  make: (count: number) => string,
  fits: (value: string) => boolean,
): string | undefined {
  if (size < 0 || !fits(make(0))) return undefined;
  let low = 0;
  let high = size;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(make(middle))) low = middle;
    else high = middle - 1;
  }
  return make(low);
}

/** Shortens text in the middle, keeping its start and its end. */
export function cutMiddle(
  text: string,
  fits: (value: string) => boolean,
): string {
  if (fits(text)) return text;
  const keep = Math.min(12, Math.floor(text.length / 3));
  return (
    longest(
      text.length - keep - 1,
      (count) => `${text.slice(0, count)}…${text.slice(text.length - keep)}`,
      fits,
    ) ?? `…${text.slice(-4)}`
  );
}

export const CHIP_GAP = 6;
/** Room kept for the "+N more" button at the end of the last line. */
export const MORE_WIDTH = 84;

/**
 * How many chips stay visible within `lines` lines. A list folds only when it
 * needs another line; the last shown line keeps at least one chip and leaves
 * room for "+N more".
 */
export function chipsThatFit(
  widths: readonly number[],
  width: number,
  lines: number,
): number {
  const lineOf: number[] = [];
  let line = 0;
  let used = 0;
  for (const chip of widths) {
    if (used > 0 && used + CHIP_GAP + chip > width) {
      line += 1;
      used = 0;
    }
    used += (used > 0 ? CHIP_GAP : 0) + chip;
    lineOf.push(line);
  }
  if (line < lines) return widths.length;
  let count = lineOf.filter((value) => value < lines).length;
  let last = 0;
  let onLast = 0;
  for (let index = 0; index < count; index++)
    if (lineOf[index] === lines - 1) {
      last += (last > 0 ? CHIP_GAP : 0) + widths[index];
      onLast += 1;
    }
  while (onLast > 1 && last + CHIP_GAP + MORE_WIDTH > width) {
    count -= 1;
    onLast -= 1;
    last -= widths[count] + CHIP_GAP;
  }
  return count;
}
