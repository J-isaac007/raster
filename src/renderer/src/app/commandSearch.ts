/**
 * Fuzzy matching for the command palette. Letters of the query must appear in
 * order; whole substrings, word starts and runs of consecutive letters score
 * higher. Returns null when there's no match.
 */
export function matchScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  const isWordStart = (i: number) => i === 0 || /[\s.\-/›]/.test(t[i - 1]);

  const at = t.indexOf(q);
  if (at >= 0) return 1000 - at + (isWordStart(at) ? 500 : 0);

  let score = 0;
  let from = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === ' ') continue;
    const i = t.indexOf(ch, from);
    if (i < 0) return null;
    score += i === prev + 1 ? 5 : 1;
    if (isWordStart(i)) score += 3;
    prev = i;
    from = i + 1;
  }
  return score;
}

/** Items matching `query`, best first; ties keep their original order. */
export function searchItems<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index, score: matchScore(query, text(item)) }))
    .filter((r): r is { item: T; index: number; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
