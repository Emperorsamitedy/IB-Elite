import type { Json } from "@/lib/supabase/database.types";
import type { LevelCode } from "./store";
import type {
  Challenge,
  DuelMatch,
  DuelQuestion,
  DuelStore,
  MatchAnswerRow,
  PerformanceEventInput,
  QueueRow,
  Season,
  SubjectRating,
} from "./store";

type Notification = {
  userId: string;
  category: string;
  title: string;
  body?: string;
  href?: string;
};

/**
 * In-memory duel store for tests. Time is injected by the caller everywhere,
 * so tests control clocks completely: pass `clock` to advance served_at.
 */
export function createFakeDuelStore(options?: {
  levels?: Record<string, LevelCode>;
  questions?: DuelQuestion[];
  clock?: () => Date;
}): DuelStore & {
  seasons: Season[];
  ratings: SubjectRating[];
  matches: DuelMatch[];
  answers: MatchAnswerRow[];
  queue: QueueRow[];
  events: PerformanceEventInput[];
  reviews: { userId: string; sourceId: string; reason: string }[];
  mistakes: { userId: string; questionId: string }[];
  notifications: Notification[];
  challenges: Challenge[];
} {
  const levels = options?.levels ?? {};
  const clock = options?.clock ?? (() => new Date());
  const questions: DuelQuestion[] =
    options?.questions ??
    Array.from({ length: 5 }, (_, i) => ({
      id: `q${i + 1}`,
      topic_id: `topic-${i % 2}`,
      title: null,
      prompt: `Question ${i + 1}`,
      marks: 2,
      difficulty: "medium",
      answer_type: "exact" as const,
      answer_key: { accept: [`a${i + 1}`] } as Json,
    }));

  const seasons: Season[] = [];
  const ratings: SubjectRating[] = [];
  const matches: DuelMatch[] = [];
  const answers: MatchAnswerRow[] = [];
  const queue: QueueRow[] = [];
  const events: PerformanceEventInput[] = [];
  const reviews: { userId: string; sourceId: string; reason: string }[] = [];
  const mistakes: { userId: string; questionId: string }[] = [];
  const notifications: Notification[] = [];
  const challenges: Challenge[] = [];
  let counter = 0;
  const nextId = () => `id-${++counter}`;
  const now = () => clock().toISOString();

  const store: DuelStore = {
    async getSeasonBySlug(slug) {
      return seasons.find((s) => s.slug === slug) ?? null;
    },
    async createSeason(slug, startsAt, endsAt) {
      const season: Season = {
        id: nextId(),
        slug,
        starts_at: startsAt,
        ends_at: endsAt,
      };
      seasons.push(season);
      return season;
    },
    async getRating(userId, subjectId, seasonId) {
      return (
        ratings.find(
          (r) =>
            r.user_id === userId &&
            r.subject_id === subjectId &&
            r.season_id === seasonId,
        ) ?? null
      );
    },
    async saveRating(rating) {
      const i = ratings.findIndex(
        (r) =>
          r.user_id === rating.user_id &&
          r.subject_id === rating.subject_id &&
          r.season_id === rating.season_id,
      );
      if (i >= 0) ratings[i] = rating;
      else ratings.push(rating);
    },
    async getStudentLevel(userId) {
      return levels[userId] ?? "SL";
    },
    async enqueue(row) {
      await store.dequeue(row.user_id, row.subject_id);
      const entry: QueueRow = { ...row, enqueued_at: now() };
      queue.push(entry);
      return entry;
    },
    async dequeue(userId, subjectId) {
      const i = queue.findIndex(
        (q) => q.user_id === userId && q.subject_id === subjectId,
      );
      if (i >= 0) queue.splice(i, 1);
    },
    async listQueue(subjectId, levelCode, mode) {
      return queue.filter(
        (q) =>
          q.subject_id === subjectId &&
          q.level_code === levelCode &&
          q.mode === mode,
      );
    },
    async claimPair(userA, userB, subjectId) {
      const mine = queue.findIndex(
        (q) => q.user_id === userA && q.subject_id === subjectId,
      );
      const theirs = queue.findIndex(
        (q) => q.user_id === userB && q.subject_id === subjectId,
      );
      if (mine < 0 || theirs < 0) return false;
      for (const index of [mine, theirs].sort((a, b) => b - a)) {
        queue.splice(index, 1);
      }
      return true;
    },
    async getActiveMatch(userId) {
      return (
        matches.find(
          (m) =>
            m.status === "ACTIVE" &&
            (m.student_a_id === userId || m.student_b_id === userId),
        ) ?? null
      );
    },
    async pickGradableQuestionIds(_subjectId, count) {
      return questions.slice(0, count).map((q) => q.id);
    },
    async createMatch(input) {
      const match: DuelMatch = {
        id: nextId(),
        subject_id: input.subjectId,
        level_code: input.levelCode,
        mode: input.mode,
        season_id: input.seasonId,
        question_ids: input.questionIds,
        student_a_id: input.studentAId,
        student_b_id: input.studentBId,
        status: input.studentBId ? "ACTIVE" : "WAITING",
        time_limit_seconds: input.timeLimitSeconds,
        started_at: input.studentBId ? now() : null,
        ended_at: null,
      };
      matches.push(match);
      return match;
    },
    async joinMatch(matchId, studentId) {
      const match = matches.find((m) => m.id === matchId);
      if (!match) throw new Error("Match not found");
      match.student_b_id = studentId;
      match.status = "ACTIVE";
      match.started_at = now();
      return match;
    },
    async getMatch(matchId) {
      return matches.find((m) => m.id === matchId) ?? null;
    },
    async finishMatch(matchId) {
      const match = matches.find((m) => m.id === matchId);
      if (!match) throw new Error("Match not found");
      match.status = "COMPLETE";
      match.ended_at = now();
      return match;
    },
    async getQuestions(ids) {
      return questions.filter((q) => ids.includes(q.id));
    },
    async recordServe(matchId, studentId, questionId, questionIndex) {
      const existing = answers.find(
        (a) =>
          a.match_id === matchId &&
          a.student_id === studentId &&
          a.question_index === questionIndex,
      );
      if (existing) return existing;
      const row: MatchAnswerRow = {
        id: nextId(),
        match_id: matchId,
        student_id: studentId,
        question_id: questionId,
        question_index: questionIndex,
        answer: null,
        is_correct: null,
        served_at: now(),
        answered_at: null,
      };
      answers.push(row);
      return row;
    },
    async recordAnswer(answerId, answer, isCorrect, answeredAt) {
      const row = answers.find((a) => a.id === answerId);
      if (!row) throw new Error("Answer row not found");
      row.answer = answer;
      row.is_correct = isCorrect;
      row.answered_at = answeredAt;
      return row;
    },
    async listAnswers(matchId) {
      return answers.filter((a) => a.match_id === matchId);
    },
    async countRecentRankedMatches(userA, userB, sinceIso) {
      return matches.filter(
        (m) =>
          m.mode === "ranked" &&
          ((m.student_a_id === userA && m.student_b_id === userB) ||
            (m.student_a_id === userB && m.student_b_id === userA)) &&
          (m.started_at ?? "") >= sinceIso,
      ).length;
    },
    async appendEvents(list) {
      events.push(...list);
    },
    async historyAccuracy(userId, subjectId) {
      const past = events.filter(
        (e) =>
          e.userId === userId &&
          e.subjectId === subjectId &&
          e.kind === "duel_answer",
      );
      if (past.length < 10) return null;
      const correct = past.filter((e) => e.payload.correct === true).length;
      return correct / past.length;
    },
    async createIntegrityReview(input) {
      reviews.push({
        userId: input.userId,
        sourceId: input.sourceId,
        reason: input.reason,
      });
    },
    async addMistake(userId, questionId) {
      if (
        !mistakes.some(
          (m) => m.userId === userId && m.questionId === questionId,
        )
      ) {
        mistakes.push({ userId, questionId });
      }
    },
    async notify(input) {
      notifications.push(input);
    },
    async createChallenge(input) {
      const challenge: Challenge = {
        id: nextId(),
        token: input.token,
        creator_id: input.creatorId,
        creator_ip_hash: input.creatorIpHash,
        opponent_id: input.opponentId,
        subject_id: input.subjectId,
        level_code: input.levelCode,
        mode: input.mode,
        match_id: null,
        claimed_by: null,
        expires_at: new Date(clock().getTime() + 7 * 864e5).toISOString(),
      };
      challenges.push(challenge);
      return challenge;
    },
    async getChallengeByToken(token) {
      return challenges.find((c) => c.token === token) ?? null;
    },
    async claimChallenge(challengeId, userId, matchId) {
      const challenge = challenges.find((c) => c.id === challengeId);
      if (!challenge) throw new Error("Challenge not found");
      challenge.claimed_by = userId;
      challenge.match_id = matchId;
    },
  };

  return Object.assign(store, {
    seasons,
    ratings,
    matches,
    answers,
    queue,
    events,
    reviews,
    mistakes,
    notifications,
    challenges,
  });
}
