import type { LadderStore } from "./store";
import { MATCH_QUESTION_COUNT, type LadderMatch } from "./types";

export type QueueResult = {
  matchId: string;
  status: LadderMatch["status"];
  match: LadderMatch;
};

/**
 * Joins the oldest WAITING match for the same subject and HL/SL level, or
 * opens a new one when nobody is waiting.
 */
export async function queueForMatch(
  store: LadderStore,
  input: {
    studentId: string;
    subjectId: string;
    paperRef?: string | null;
    paperYear?: number | null;
  },
): Promise<QueueResult> {
  const level = await store.getStudentLevel(input.studentId, input.subjectId);
  const waiting = await store.findWaitingMatch(
    input.subjectId,
    level,
    input.studentId,
  );

  let match: LadderMatch;
  if (waiting) {
    match = await store.joinMatch(waiting.id, input.studentId);
  } else {
    // The question list is fixed at creation so both players race through
    // the same paper in the same order.
    const questionIds = await store.pickQuestionIds(
      input.subjectId,
      MATCH_QUESTION_COUNT,
    );
    if (questionIds.length === 0) {
      throw new Error("No published questions for this subject yet.");
    }
    match = await store.createWaitingMatch({
      subjectId: input.subjectId,
      level,
      studentId: input.studentId,
      paperRef: input.paperRef ?? null,
      paperYear: input.paperYear ?? null,
      questionIds,
    });
  }

  return { matchId: match.id, status: match.status, match };
}
