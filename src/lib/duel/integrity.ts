/**
 * Statistical outlier checks shared by the competitive pillars. Heuristics
 * only ever FLAG — quarantine and human review decide; nothing here bans.
 */

export type AnswerTiming = { elapsedMs: number; correct: boolean };

export type IntegrityFlag = {
  code: "impossible_speed" | "speed_accuracy_outlier" | "history_deviation";
  detail: string;
};

/** Faster than a human can read a question, let alone answer it. */
export const MIN_PLAUSIBLE_MS = 2500;

/**
 * Flags a completed side. `historyAccuracy` is the player's mean accuracy
 * over prior rated events in this subject (null when too little history).
 */
export function flagSide(
  answers: AnswerTiming[],
  historyAccuracy: number | null,
): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];
  if (answers.length === 0) return flags;

  const correct = answers.filter((a) => a.correct).length;
  const accuracy = correct / answers.length;
  const meanMs =
    answers.reduce((sum, a) => sum + a.elapsedMs, 0) / answers.length;

  const fastCorrect = answers.filter(
    (a) => a.correct && a.elapsedMs < MIN_PLAUSIBLE_MS,
  ).length;
  if (fastCorrect >= 2) {
    flags.push({
      code: "impossible_speed",
      detail: `${fastCorrect} correct answers under ${MIN_PLAUSIBLE_MS}ms`,
    });
  }

  if (accuracy === 1 && meanMs < MIN_PLAUSIBLE_MS * 2) {
    flags.push({
      code: "speed_accuracy_outlier",
      detail: `perfect score at ${Math.round(meanMs)}ms mean answer time`,
    });
  }

  // A big jump over the player's own established accuracy is worth a look;
  // requires history so new players are never flagged for improving.
  if (historyAccuracy !== null && accuracy - historyAccuracy > 0.5) {
    flags.push({
      code: "history_deviation",
      detail: `accuracy ${accuracy.toFixed(2)} vs historical ${historyAccuracy.toFixed(2)}`,
    });
  }

  return flags;
}

/** Flags severe enough to withhold rating updates pending review. */
export function shouldQuarantine(flags: IntegrityFlag[]): boolean {
  return flags.some(
    (f) => f.code === "impossible_speed" || f.code === "speed_accuracy_outlier",
  );
}
