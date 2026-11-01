// Before/after comparison of two history runs (plain data in, plain data out).

export const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'];

/**
 * @param {{score: number, counts: Object<string, number>}} before
 * @param {{score: number, counts: Object<string, number>}} after
 */
export function compareRuns(before, after) {
  return {
    score: { before: before.score, after: after.score, change: after.score - before.score },
    counts: SEVERITIES.map((severity) => {
      const b = before.counts[severity] ?? 0;
      const a = after.counts[severity] ?? 0;
      return { severity, before: b, after: a, change: a - b };
    }),
  };
}

/** "up 15", "down 3" or "no change": the change in words, never by colour alone. */
export const describeScoreChange = (change) =>
  change === 0 ? 'no change' : `${change > 0 ? 'up' : 'down'} ${Math.abs(change)}`;

/** "2 fewer", "1 more" or "no change", for issue counts (fewer is better). */
export const describeCountChange = (change) =>
  change === 0 ? 'no change' : `${Math.abs(change)} ${change < 0 ? 'fewer' : 'more'}`;
