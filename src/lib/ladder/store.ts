import type {
  LadderLeaderboardRow,
  LadderMatch,
  LadderProgress,
  LevelCode,
} from "./types";

export type LeaderboardFilter = {
  country?: string;
  school?: string;
  limit?: number;
};

export type LeaderboardIdentity = {
  country?: string | null;
  school?: string | null;
};

/**
 * Storage seam for the ladder. The Supabase implementation lives in
 * `supabase-store.ts`; tests supply an in-memory fake.
 */
export type LadderStore = {
  findWaitingMatch(
    subjectId: string,
    level: LevelCode,
    studentId: string,
  ): Promise<LadderMatch | null>;
  createWaitingMatch(input: {
    subjectId: string;
    level: LevelCode;
    studentId: string;
    paperRef: string | null;
    paperYear: number | null;
    questionIds: string[];
  }): Promise<LadderMatch>;
  /** Random published question ids for the subject, newest bank first. */
  pickQuestionIds(subjectId: string, count: number): Promise<string[]>;
  joinMatch(matchId: string, studentId: string): Promise<LadderMatch>;
  getMatch(matchId: string): Promise<LadderMatch | null>;
  getStudentLevel(studentId: string, subjectId: string): Promise<LevelCode>;
  upsertProgress(input: {
    matchId: string;
    studentId: string;
    questionIndex: number;
    correctCount: number;
  }): Promise<LadderProgress>;
  completeSide(input: {
    matchId: string;
    studentId: string;
    finalScore: number;
  }): Promise<LadderProgress>;
  listProgress(matchId: string): Promise<LadderProgress[]>;
  /** Country/school are not on `profiles`, so each player supplies their own. */
  saveIdentity(
    studentId: string,
    identity: LeaderboardIdentity,
  ): Promise<LadderLeaderboardRow>;
  finishMatch(matchId: string): Promise<LadderMatch>;
  recordResult(input: {
    studentId: string;
    won: boolean;
    drew: boolean;
  }): Promise<LadderLeaderboardRow>;
  leaderboard(filter: LeaderboardFilter): Promise<LadderLeaderboardRow[]>;
};
