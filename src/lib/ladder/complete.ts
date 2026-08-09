import type { LadderStore, LeaderboardIdentity } from "./store";
import {
  PROGRESS_EVENT,
  matchChannel,
  type LadderMatch,
  type LadderPublisher,
} from "./types";

export type CompleteResult = {
  match: LadderMatch;
  matchComplete: boolean;
};

/**
 * Marks one side finished. Once both sides are in, the match closes and both
 * players' win/loss records are updated (a tie counts as neither).
 */
export async function completeSide(
  store: LadderStore,
  publisher: LadderPublisher,
  input: {
    matchId: string;
    studentId: string;
    finalScore: number;
    identity?: LeaderboardIdentity;
  },
): Promise<CompleteResult> {
  if (input.identity?.country || input.identity?.school) {
    await store.saveIdentity(input.studentId, input.identity);
  }

  const progress = await store.completeSide({
    matchId: input.matchId,
    studentId: input.studentId,
    finalScore: input.finalScore,
  });

  await publisher.publish(matchChannel(input.matchId), PROGRESS_EVENT, {
    matchId: input.matchId,
    studentId: input.studentId,
    questionIndex: progress.current_question_index,
    correctCount: progress.correct_count,
    isComplete: true,
  });

  const match = await store.getMatch(input.matchId);
  if (!match) throw new Error("Match not found");

  const sides = await store.listProgress(input.matchId);
  const bothIn =
    match.student_b_id !== null &&
    sides.length === 2 &&
    sides.every((side) => side.is_complete);
  if (!bothIn) return { match, matchComplete: false };

  const [first, second] = sides;
  const drew = (first.final_score ?? 0) === (second.final_score ?? 0);
  const winnerId =
    (first.final_score ?? 0) > (second.final_score ?? 0)
      ? first.student_id
      : second.student_id;

  for (const side of sides) {
    await store.recordResult({
      studentId: side.student_id,
      won: !drew && side.student_id === winnerId,
      drew,
    });
  }

  const finished = await store.finishMatch(input.matchId);
  return { match: finished, matchComplete: true };
}
