export type LadderStatus = "WAITING" | "ACTIVE" | "COMPLETE";

export type LevelCode = "SL" | "HL";

export type LadderMatch = {
  id: string;
  subject_id: string;
  paper_ref: string | null;
  paper_year: number | null;
  level_code: LevelCode;
  student_a_id: string;
  student_b_id: string | null;
  status: LadderStatus;
  started_at: string | null;
  ended_at: string | null;
};

export type LadderProgress = {
  id: string;
  match_id: string;
  student_id: string;
  current_question_index: number;
  correct_count: number;
  final_score: number | null;
  is_complete: boolean;
  last_updated_at: string;
};

export type LadderLeaderboardRow = {
  id: string;
  student_id: string;
  country: string | null;
  school: string | null;
  wins: number;
  losses: number;
  updated_at: string;
};

/**
 * Everything an opponent is allowed to see: position and score only, never
 * prompts, answers or solutions.
 */
export type ProgressEvent = {
  matchId: string;
  studentId: string;
  questionIndex: number;
  correctCount: number;
  isComplete: boolean;
};

export type LadderPublisher = {
  publish(channel: string, event: string, payload: ProgressEvent): Promise<void>;
};

export function matchChannel(matchId: string): string {
  return `ladder-${matchId}`;
}

export const PROGRESS_EVENT = "progress";
