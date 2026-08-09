import type { LadderStore } from "./store";
import type { LadderMatch } from "./types";

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

  const match = waiting
    ? await store.joinMatch(waiting.id, input.studentId)
    : await store.createWaitingMatch({
        subjectId: input.subjectId,
        level,
        studentId: input.studentId,
        paperRef: input.paperRef ?? null,
        paperYear: input.paperYear ?? null,
      });

  return { matchId: match.id, status: match.status, match };
}
