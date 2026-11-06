/**
 * Home example queries — random draw.
 *
 * Partial Fisher–Yates over a copy: the first `count` slots of the shuffle are
 * returned, so every entry appears at most once and the input is untouched.
 * `random` is injectable so tests (and callers) control the draw.
 */
export function pickExamples<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const deck = [...items];
  const take = Math.min(Math.max(0, count), deck.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(random() * (deck.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, take);
}
