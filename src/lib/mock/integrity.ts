/**
 * Mock-sitting integrity checks. Like the duel checks these only FLAG;
 * quarantine excludes a script from rankings until a human reviews it.
 */

export type MockIntegrityFlag = {
  code: "impossible_write_speed" | "empty_script_scored" | "score_history_outlier";
  detail: string;
};

/** Below this share of the exam duration, a high-scoring script is suspect. */
const MIN_TIME_SHARE = 0.15;

export function flagMockEntry(input: {
  durationMinutes: number;
  startedAt: string;
  submittedAt: string;
  transcriptLength: number;
  scoreShare: number; // awarded / max, 0..1
  /** Mean scoreShare over the student's prior graded mocks; null if none. */
  historyScoreShare: number | null;
}): MockIntegrityFlag[] {
  const flags: MockIntegrityFlag[] = [];
  const writeMs =
    new Date(input.submittedAt).getTime() - new Date(input.startedAt).getTime();
  const share = writeMs / (input.durationMinutes * 60_000);

  if (share < MIN_TIME_SHARE && input.scoreShare > 0.6) {
    flags.push({
      code: "impossible_write_speed",
      detail: `scored ${Math.round(input.scoreShare * 100)}% using ${Math.round(share * 100)}% of the exam time`,
    });
  }
  if (input.transcriptLength < 20 && input.scoreShare > 0.3) {
    flags.push({
      code: "empty_script_scored",
      detail: `near-empty transcript (${input.transcriptLength} chars) scored ${Math.round(input.scoreShare * 100)}%`,
    });
  }
  if (
    input.historyScoreShare !== null &&
    input.scoreShare - input.historyScoreShare > 0.45
  ) {
    flags.push({
      code: "score_history_outlier",
      detail: `${Math.round(input.scoreShare * 100)}% vs historical ${Math.round(input.historyScoreShare * 100)}%`,
    });
  }
  return flags;
}

export function shouldQuarantineMock(flags: MockIntegrityFlag[]): boolean {
  return flags.some(
    (f) => f.code === "impossible_write_speed" || f.code === "empty_script_scored",
  );
}
