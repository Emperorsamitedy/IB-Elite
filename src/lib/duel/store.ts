import type { Json } from "@/lib/supabase/database.types";
import type { AnswerType } from "./answers";

export type LevelCode = "SL" | "HL";


export type DuelMode = "ranked" | "friendly";

export type Season = {
  id: string;
  slug: string;
  starts_at: string;
  ends_at: string;
};

export type SubjectRating = {
  user_id: string;
  subject_id: string;
  season_id: string;
  elo: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
};

export type DuelMatch = {
  id: string;
  subject_id: string;
  level_code: LevelCode;
  mode: DuelMode;
  season_id: string | null;
  question_ids: string[];
  student_a_id: string;
  student_b_id: string | null;
  status: "WAITING" | "ACTIVE" | "COMPLETE";
  time_limit_seconds: number;
  started_at: string | null;
  ended_at: string | null;
};

export type MatchAnswerRow = {
  id: string;
  match_id: string;
  student_id: string;
  question_id: string;
  question_index: number;
  answer: string | null;
  is_correct: boolean | null;
  served_at: string;
  answered_at: string | null;
};

export type DuelQuestion = {
  id: string;
  topic_id: string;
  title: string | null;
  prompt: string;
  marks: number;
  difficulty: string;
  answer_type: AnswerType;
  answer_key: Json | null;
};

export type QueueRow = {
  user_id: string;
  subject_id: string;
  level_code: LevelCode;
  elo: number;
  mode: DuelMode;
  ip_hash: string | null;
  enqueued_at: string;
};

export type Challenge = {
  id: string;
  token: string;
  creator_id: string;
  opponent_id: string | null;
  subject_id: string;
  level_code: LevelCode;
  mode: DuelMode;
  match_id: string | null;
  claimed_by: string | null;
  creator_ip_hash: string | null;
  expires_at: string;
};

export type PerformanceEventInput = {
  userId: string;
  subjectId: string | null;
  kind: "duel_answer" | "duel_result";
  payload: Record<string, Json>;
  integrityFlags?: Json[];
  quarantined?: boolean;
};

/**
 * Storage seam for ranked duels. The Supabase implementation goes through
 * the service role — ratings, answers and timing are never client-writable.
 */
export type DuelStore = {
  // seasons + ratings
  getSeasonBySlug(slug: string): Promise<Season | null>;
  createSeason(slug: string, startsAt: string, endsAt: string): Promise<Season>;
  getRating(
    userId: string,
    subjectId: string,
    seasonId: string,
  ): Promise<SubjectRating | null>;
  saveRating(rating: SubjectRating): Promise<void>;

  // matchmaking
  getStudentLevel(userId: string, subjectId: string): Promise<LevelCode>;
  enqueue(row: Omit<QueueRow, "enqueued_at">): Promise<QueueRow>;
  dequeue(userId: string, subjectId: string): Promise<void>;
  listQueue(
    subjectId: string,
    levelCode: LevelCode,
    mode: DuelMode,
  ): Promise<QueueRow[]>;
  /** Atomically removes BOTH queue rows; false when a concurrent pairing won. */
  claimPair(userA: string, userB: string, subjectId: string): Promise<boolean>;
  /** The user's most recent non-complete two-player match, if any. */
  getActiveMatch(userId: string): Promise<DuelMatch | null>;

  // matches
  pickGradableQuestionIds(subjectId: string, count: number): Promise<string[]>;
  createMatch(input: {
    subjectId: string;
    levelCode: LevelCode;
    mode: DuelMode;
    seasonId: string | null;
    studentAId: string;
    studentBId: string | null;
    questionIds: string[];
    timeLimitSeconds: number;
  }): Promise<DuelMatch>;
  joinMatch(matchId: string, studentId: string): Promise<DuelMatch>;
  getMatch(matchId: string): Promise<DuelMatch | null>;
  finishMatch(matchId: string): Promise<DuelMatch>;
  getQuestions(ids: string[]): Promise<DuelQuestion[]>;

  // per-question server record
  recordServe(
    matchId: string,
    studentId: string,
    questionId: string,
    questionIndex: number,
  ): Promise<MatchAnswerRow>;
  recordAnswer(
    answerId: string,
    answer: string,
    isCorrect: boolean,
    answeredAt: string,
  ): Promise<MatchAnswerRow>;
  listAnswers(matchId: string): Promise<MatchAnswerRow[]>;

  // ledger, diagnostics, review
  /** Ranked matches between this exact pair since the cutoff. */
  countRecentRankedMatches(
    userA: string,
    userB: string,
    sinceIso: string,
  ): Promise<number>;
  appendEvents(events: PerformanceEventInput[]): Promise<void>;
  historyAccuracy(userId: string, subjectId: string): Promise<number | null>;
  createIntegrityReview(input: {
    userId: string;
    sourceKind: "duel_match";
    sourceId: string;
    reason: string;
    details: Record<string, Json>;
  }): Promise<void>;
  addMistake(userId: string, questionId: string, topicId: string): Promise<void>;
  notify(input: {
    userId: string;
    category: "duels" | "season";
    title: string;
    body?: string;
    href?: string;
  }): Promise<void>;

  // challenges
  createChallenge(input: {
    token: string;
    creatorId: string;
    opponentId: string | null;
    subjectId: string;
    levelCode: LevelCode;
    mode: DuelMode;
    creatorIpHash: string | null;
  }): Promise<Challenge>;
  getChallengeByToken(token: string): Promise<Challenge | null>;
  claimChallenge(
    challengeId: string,
    userId: string,
    matchId: string,
  ): Promise<void>;
};
