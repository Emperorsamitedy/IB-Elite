/**
 * Match scoring: accuracy first, total answer time as tiebreaker. All inputs
 * come from server-stamped `match_answers` rows — the client never supplies
 * a time or a correctness verdict.
 */

export type SideResult = {
  studentId: string;
  correct: number;
  /** Sum of (answered_at - served_at) in ms, each capped at the per-question budget. */
  totalTimeMs: number;
};

export type MatchVerdict =
  | { kind: "winner"; winnerId: string; loserId: string; onTime: boolean }
  | { kind: "draw" };

export function decideMatch(a: SideResult, b: SideResult): MatchVerdict {
  if (a.correct !== b.correct) {
    const [winner, loser] = a.correct > b.correct ? [a, b] : [b, a];
    return {
      kind: "winner",
      winnerId: winner.studentId,
      loserId: loser.studentId,
      onTime: false,
    };
  }
  if (a.totalTimeMs !== b.totalTimeMs) {
    const [winner, loser] = a.totalTimeMs < b.totalTimeMs ? [a, b] : [b, a];
    return {
      kind: "winner",
      winnerId: winner.studentId,
      loserId: loser.studentId,
      onTime: true,
    };
  }
  return { kind: "draw" };
}

/**
 * Per-question time budget. Answers arriving after the budget are recorded
 * but graded wrong; the elapsed time counts as the full budget so a stalled
 * player can't win the tiebreaker by never answering.
 */
export function perQuestionBudgetMs(
  timeLimitSeconds: number,
  questionCount: number,
): number {
  return Math.floor((timeLimitSeconds * 1000) / Math.max(1, questionCount));
}

export function elapsedWithinBudget(
  servedAt: string,
  answeredAt: string,
  budgetMs: number,
): { elapsedMs: number; onTime: boolean } {
  const elapsed = new Date(answeredAt).getTime() - new Date(servedAt).getTime();
  const clamped = Math.max(0, elapsed);
  return { elapsedMs: Math.min(clamped, budgetMs), onTime: clamped <= budgetMs };
}
