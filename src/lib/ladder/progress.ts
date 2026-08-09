import type { LadderStore } from "./store";
import {
  PROGRESS_EVENT,
  matchChannel,
  type LadderPublisher,
  type ProgressEvent,
} from "./types";

/**
 * Records a student's position and broadcasts it to the match channel. The
 * payload carries position and score only — never question content.
 */
export async function recordProgress(
  store: LadderStore,
  publisher: LadderPublisher,
  input: {
    matchId: string;
    studentId: string;
    questionIndex: number;
    isCorrect: boolean;
  },
): Promise<ProgressEvent> {
  const existing = (await store.listProgress(input.matchId)).find(
    (row) => row.student_id === input.studentId,
  );
  const correctCount = (existing?.correct_count ?? 0) + (input.isCorrect ? 1 : 0);

  const progress = await store.upsertProgress({
    matchId: input.matchId,
    studentId: input.studentId,
    questionIndex: input.questionIndex,
    correctCount,
  });

  const event: ProgressEvent = {
    matchId: input.matchId,
    studentId: input.studentId,
    questionIndex: progress.current_question_index,
    correctCount: progress.correct_count,
    isComplete: progress.is_complete,
  };

  await publisher.publish(matchChannel(input.matchId), PROGRESS_EVENT, event);
  return event;
}
