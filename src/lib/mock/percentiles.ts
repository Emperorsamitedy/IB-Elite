/**
 * Percentile rank over the ranked cohort (on-time, non-quarantined entries
 * of one paper across all bands). Standard PR formula: below + half of the
 * other ties, over the cohort size. Callers hide percentiles for cohorts
 * too small to mean anything (see MIN_COHORT).
 */
/** Below this many ranked sitters, a percentile is noise — do not show one. */
export const MIN_COHORT = 5;

export function percentileRank(scores: number[], mine: number): number {
  if (scores.length === 0) return 50;
  const below = scores.filter((s) => s < mine).length;
  const ties = scores.filter((s) => s === mine).length;
  // `scores` includes the student's own entry.
  const tiesExcludingSelf = Math.max(0, ties - 1);
  return Math.round(((below + 0.5 * tiesExcludingSelf) / scores.length) * 100);
}

/** 1-based rank (highest score = 1), ties share the better rank. */
export function rankOf(scores: number[], mine: number): number {
  return scores.filter((s) => s > mine).length + 1;
}

/** Mean per-criterion award of the top decile, for the paid comparison. */
export function topDecileByCriterion(
  entries: { total: number; criteria: { criterionId: string; awarded: number }[] }[],
): Map<string, number> {
  if (entries.length === 0) return new Map();
  const sorted = [...entries].sort((a, b) => b.total - a.total);
  const cutoff = Math.max(1, Math.ceil(sorted.length / 10));
  const top = sorted.slice(0, cutoff);
  const sums = new Map<string, number>();
  for (const entry of top) {
    for (const c of entry.criteria) {
      sums.set(c.criterionId, (sums.get(c.criterionId) ?? 0) + c.awarded);
    }
  }
  const means = new Map<string, number>();
  for (const [id, sum] of sums) {
    means.set(id, Math.round((sum / top.length) * 10) / 10);
  }
  return means;
}
