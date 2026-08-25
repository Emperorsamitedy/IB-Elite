import type { Json } from "@/lib/supabase/database.types";
import { gradeAnswer } from "./answers";
import { ELO_INITIAL, softReset, updateElo, type MatchOutcome } from "./elo";
import { flagSide, shouldQuarantine, type AnswerTiming } from "./integrity";
import { pickOpponent } from "./matchmaking";
import {
  decideMatch,
  elapsedWithinBudget,
  perQuestionBudgetMs,
  type SideResult,
} from "./scoring";
import { previousSeasonSlug, seasonBounds, seasonSlug } from "./season";
import type {
  DuelMatch,
  DuelMode,
  DuelQuestion,
  DuelStore,
  MatchAnswerRow,
  Season,
  SubjectRating,
} from "./store";

export const MATCH_QUESTION_COUNT = 5;
export const MATCH_TIME_LIMIT_SECONDS = 450;
/** Grace on top of the time limit before an absent opponent forfeits. */
const FORFEIT_GRACE_MS = 30_000;

// ---------------------------------------------------------------
// Seasons and ratings
// ---------------------------------------------------------------

export async function getOrCreateSeason(
  store: DuelStore,
  now: Date,
): Promise<Season> {
  const slug = seasonSlug(now);
  const existing = await store.getSeasonBySlug(slug);
  if (existing) return existing;
  const { startsAt, endsAt } = seasonBounds(now);
  return store.createSeason(slug, startsAt.toISOString(), endsAt.toISOString());
}

/**
 * The player's rating row for this season, created on first use. A new
 * season starts from last season's rating soft-reset toward the anchor.
 */
export async function getOrCreateRating(
  store: DuelStore,
  userId: string,
  subjectId: string,
  season: Season,
): Promise<SubjectRating> {
  const existing = await store.getRating(userId, subjectId, season.id);
  if (existing) return existing;

  let elo = ELO_INITIAL;
  const prevSeason = await store.getSeasonBySlug(previousSeasonSlug(season.slug));
  if (prevSeason) {
    const prev = await store.getRating(userId, subjectId, prevSeason.id);
    if (prev) elo = softReset(prev.elo);
  }

  const rating: SubjectRating = {
    user_id: userId,
    subject_id: subjectId,
    season_id: season.id,
    elo,
    matches_played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
  await store.saveRating(rating);
  return rating;
}

// ---------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------

export type QueueOutcome =
  | { status: "queued" }
  | { status: "matched"; match: DuelMatch };

/**
 * Enqueues the player, then tries to pair immediately. Pairing also runs on
 * every poll, so two players who both queued into an empty window still meet
 * as their windows widen.
 */
export async function queueForDuel(
  store: DuelStore,
  input: {
    userId: string;
    subjectId: string;
    mode: DuelMode;
    ipHash?: string | null;
  },
  now: Date,
): Promise<QueueOutcome> {
  const season = await getOrCreateSeason(store, now);
  const rating = await getOrCreateRating(
    store,
    input.userId,
    input.subjectId,
    season,
  );
  const levelCode = await store.getStudentLevel(input.userId, input.subjectId);

  await store.enqueue({
    user_id: input.userId,
    subject_id: input.subjectId,
    level_code: levelCode,
    elo: rating.elo,
    mode: input.mode,
    ip_hash: input.ipHash ?? null,
  });

  return tryPair(store, input.userId, input.subjectId, now);
}

/** Attempts to pair the given queued player; called on enqueue and on poll. */
export async function tryPair(
  store: DuelStore,
  userId: string,
  subjectId: string,
  now: Date,
): Promise<QueueOutcome> {
  const season = await getOrCreateSeason(store, now);
  const levelCode = await store.getStudentLevel(userId, subjectId);

  // The seeker may already have been paired by the opponent's poll.
  const queue = await store.listQueue(subjectId, levelCode, "ranked");
  const friendlyQueue = await store.listQueue(subjectId, levelCode, "friendly");
  const seeker = [...queue, ...friendlyQueue].find((q) => q.user_id === userId);
  if (!seeker) return { status: "queued" };

  const pool = seeker.mode === "ranked" ? queue : friendlyQueue;
  const candidates = pool.map((q) => ({
    userId: q.user_id,
    elo: q.elo,
    enqueuedAt: q.enqueued_at,
    ipHash: q.ip_hash,
  }));
  const opponent = pickOpponent(
    {
      userId,
      elo: seeker.elo,
      enqueuedAt: seeker.enqueued_at,
      ipHash: seeker.ip_hash,
    },
    candidates,
    now,
  );
  if (!opponent) return { status: "queued" };

  const questionIds = await store.pickGradableQuestionIds(
    subjectId,
    MATCH_QUESTION_COUNT,
  );
  if (questionIds.length === 0) {
    throw new Error(
      "No duel-ready questions for this subject yet. Ask an admin to add structured answer keys.",
    );
  }

  const match = await store.createMatch({
    subjectId,
    levelCode,
    mode: seeker.mode,
    seasonId: seeker.mode === "ranked" ? season.id : null,
    studentAId: userId,
    studentBId: opponent.userId,
    questionIds,
    timeLimitSeconds: MATCH_TIME_LIMIT_SECONDS,
  });

  await store.dequeue(userId, subjectId);
  await store.dequeue(opponent.userId, subjectId);
  await store.notify({
    userId: opponent.userId,
    category: "duels",
    title: "Opponent found — your duel is live",
    href: `/duel/${match.id}`,
  });

  return { status: "matched", match };
}

// ---------------------------------------------------------------
// Match state and answering
// ---------------------------------------------------------------

export type SideState = {
  studentId: string;
  answered: number;
  correct: number;
  totalTimeMs: number;
  isComplete: boolean;
};

export type MatchState = {
  match: DuelMatch;
  you: SideState;
  opponent: SideState | null;
  totalQuestions: number;
  /** Present only while you still have questions left; never carries the key. */
  currentQuestion: {
    index: number;
    id: string;
    title: string | null;
    prompt: string;
    marks: number;
    difficulty: string;
    answerType: string;
    options: string[] | null;
    servedAt: string;
    budgetMs: number;
  } | null;
  verdict: { result: "won" | "lost" | "drew"; yourElo?: number; delta?: number } | null;
};

/**
 * Authoritative match state for one player. Serving the current question
 * stamps `served_at` server-side, which starts that question's clock.
 */
export async function getMatchState(
  store: DuelStore,
  matchId: string,
  userId: string,
  now: Date,
): Promise<MatchState> {
  let match = await store.getMatch(matchId);
  if (!match) throw new DuelError("Match not found", 404);
  if (match.student_a_id !== userId && match.student_b_id !== userId) {
    throw new DuelError("Not your match", 403);
  }

  const questions = await store.getQuestions(match.question_ids);
  const budgetMs = perQuestionBudgetMs(
    match.time_limit_seconds,
    match.question_ids.length,
  );
  let answers = await store.listAnswers(matchId);

  const yourRows = answers.filter((a) => a.student_id === userId);
  const yourAnswered = yourRows.filter((a) => a.answered_at !== null).length;
  const yourDone = yourAnswered >= match.question_ids.length;

  let currentQuestion: MatchState["currentQuestion"] = null;
  if (match.status === "ACTIVE" && !yourDone) {
    const index = yourAnswered;
    const questionId = match.question_ids[index];
    const question = questions.find((q) => q.id === questionId);
    if (question) {
      const served = await store.recordServe(matchId, userId, questionId, index);
      currentQuestion = {
        index,
        id: question.id,
        title: question.title,
        prompt: question.prompt,
        marks: question.marks,
        difficulty: question.difficulty,
        answerType: question.answer_type,
        options: optionsOf(question),
        servedAt: served.served_at,
        budgetMs,
      };
      answers = await store.listAnswers(matchId);
    }
  }

  // An opponent who went silent past the limit forfeits their remaining
  // questions; checked lazily so no cron is needed for liveness.
  if (match.status === "ACTIVE" && match.student_b_id) {
    const finalized = await finalizeIfDue(store, match, questions, answers, now);
    if (finalized) {
      match = finalized;
      answers = await store.listAnswers(matchId);
    }
  }

  const sides = sideStates(match, answers, budgetMs);
  const you = sides.find((s) => s.studentId === userId)!;
  const opponent = sides.find((s) => s.studentId !== userId) ?? null;

  let verdict: MatchState["verdict"] = null;
  if (match.status === "COMPLETE" && opponent) {
    const result = decideMatch(toSideResult(you), toSideResult(opponent));
    verdict = {
      result:
        result.kind === "draw"
          ? "drew"
          : result.winnerId === userId
            ? "won"
            : "lost",
    };
  }

  return {
    match,
    you,
    opponent,
    totalQuestions: match.question_ids.length,
    currentQuestion,
    verdict,
  };
}

export class DuelError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Grades and records one answer, server-side. Late answers (past the
 * per-question budget) are recorded wrong. Completing the second side
 * finalizes the match: verdict, Elo, ledger, diagnostics, notifications.
 */
export async function submitAnswer(
  store: DuelStore,
  input: {
    matchId: string;
    userId: string;
    questionIndex: number;
    answer: string;
  },
  now: Date,
): Promise<{ isCorrect: boolean; matchComplete: boolean }> {
  const match = await store.getMatch(input.matchId);
  if (!match) throw new DuelError("Match not found", 404);
  if (match.student_a_id !== input.userId && match.student_b_id !== input.userId) {
    throw new DuelError("Not your match", 403);
  }
  if (match.status !== "ACTIVE") throw new DuelError("Match is not live", 409);

  const answers = await store.listAnswers(input.matchId);
  const mine = answers.filter((a) => a.student_id === input.userId);
  const expectedIndex = mine.filter((a) => a.answered_at !== null).length;
  if (input.questionIndex !== expectedIndex) {
    throw new DuelError("Answer out of order", 409);
  }
  const serve = mine.find((a) => a.question_index === input.questionIndex);
  if (!serve || serve.answered_at !== null) {
    throw new DuelError("Question was not served", 409);
  }

  const questions = await store.getQuestions(match.question_ids);
  const question = questions.find((q) => q.id === serve.question_id);
  if (!question) throw new DuelError("Question missing", 500);

  const budgetMs = perQuestionBudgetMs(
    match.time_limit_seconds,
    match.question_ids.length,
  );
  const { onTime } = elapsedWithinBudget(
    serve.served_at,
    now.toISOString(),
    budgetMs,
  );
  const isCorrect =
    onTime && gradeAnswer(question.answer_type, question.answer_key, input.answer);

  await store.recordAnswer(serve.id, input.answer, isCorrect, now.toISOString());

  const updated = await store.listAnswers(input.matchId);
  const complete = await maybeFinalize(store, match, questions, updated, now);
  return { isCorrect, matchComplete: complete };
}

// ---------------------------------------------------------------
// Finalization: verdict, Elo, ledger, diagnostics
// ---------------------------------------------------------------

function sideStates(
  match: DuelMatch,
  answers: MatchAnswerRow[],
  budgetMs: number,
): SideState[] {
  const players = [match.student_a_id, match.student_b_id].filter(
    (p): p is string => p !== null,
  );
  return players.map((studentId) => {
    const rows = answers.filter(
      (a) => a.student_id === studentId && a.answered_at !== null,
    );
    let totalTimeMs = 0;
    for (const row of rows) {
      totalTimeMs += elapsedWithinBudget(
        row.served_at,
        row.answered_at!,
        budgetMs,
      ).elapsedMs;
    }
    return {
      studentId,
      answered: rows.length,
      correct: rows.filter((a) => a.is_correct).length,
      totalTimeMs,
      isComplete: rows.length >= match.question_ids.length,
    };
  });
}

function toSideResult(side: SideState): SideResult {
  return {
    studentId: side.studentId,
    correct: side.correct,
    totalTimeMs: side.totalTimeMs,
  };
}

async function maybeFinalize(
  store: DuelStore,
  match: DuelMatch,
  questions: DuelQuestion[],
  answers: MatchAnswerRow[],
  now: Date,
): Promise<boolean> {
  if (!match.student_b_id) return false;
  const budgetMs = perQuestionBudgetMs(
    match.time_limit_seconds,
    match.question_ids.length,
  );
  const sides = sideStates(match, answers, budgetMs);
  if (!sides.every((s) => s.isComplete)) return false;
  await finalize(store, match, questions, answers, sides, now);
  return true;
}

/** Forfeits an opponent who is past the time limit + grace, then finalizes. */
async function finalizeIfDue(
  store: DuelStore,
  match: DuelMatch,
  questions: DuelQuestion[],
  answers: MatchAnswerRow[],
  now: Date,
): Promise<DuelMatch | null> {
  if (!match.student_b_id || !match.started_at) return null;
  const budgetMs = perQuestionBudgetMs(
    match.time_limit_seconds,
    match.question_ids.length,
  );
  const sides = sideStates(match, answers, budgetMs);
  const lagging = sides.filter((s) => !s.isComplete);
  if (lagging.length === 0 || lagging.length === sides.length) return null;

  const deadline =
    new Date(match.started_at).getTime() +
    match.time_limit_seconds * 1000 +
    FORFEIT_GRACE_MS;
  if (now.getTime() < deadline) return null;

  // Remaining questions count as wrong at full budget — recorded as-is;
  // sideStates already treats unanswered rows as zero correct, and the
  // decideMatch accuracy comparison settles it.
  await finalize(store, match, questions, answers, sides, now);
  return store.getMatch(match.id);
}

async function finalize(
  store: DuelStore,
  match: DuelMatch,
  questions: DuelQuestion[],
  answers: MatchAnswerRow[],
  sides: SideState[],
  now: Date,
): Promise<void> {
  const budgetMs = perQuestionBudgetMs(
    match.time_limit_seconds,
    match.question_ids.length,
  );
  const verdict = decideMatch(toSideResult(sides[0]), toSideResult(sides[1]));

  // Integrity pass per side, before any rating moves.
  const quarantinedSides = new Set<string>();
  for (const side of sides) {
    const timings: AnswerTiming[] = answers
      .filter((a) => a.student_id === side.studentId && a.answered_at !== null)
      .map((a) => ({
        elapsedMs: elapsedWithinBudget(a.served_at, a.answered_at!, budgetMs)
          .elapsedMs,
        correct: a.is_correct === true,
      }));
    const history = await store.historyAccuracy(side.studentId, match.subject_id);
    const flags = flagSide(timings, history);
    if (flags.length > 0) {
      await store.createIntegrityReview({
        userId: side.studentId,
        sourceKind: "duel_match",
        sourceId: match.id,
        reason: flags.map((f) => f.code).join(","),
        details: { flags: flags as unknown as Json },
      });
      if (shouldQuarantine(flags)) quarantinedSides.add(side.studentId);
    }
  }
  const quarantined = quarantinedSides.size > 0;

  // Elo farming leaves a trail: the same two accounts trading ranked
  // matches all day. Flag for review — never auto-punish; siblings and
  // classmates on one subject are legitimate.
  if (match.mode === "ranked" && match.student_b_id) {
    const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
    const recent = await store.countRecentRankedMatches(
      match.student_a_id,
      match.student_b_id,
      since,
    );
    if (recent >= 5) {
      for (const side of sides) {
        await store.createIntegrityReview({
          userId: side.studentId,
          sourceKind: "duel_match",
          sourceId: match.id,
          reason: "excessive_rematch",
          details: { pairMatchesLast24h: recent },
        });
      }
    }
  }

  // Elo — ranked only, withheld entirely when either side is quarantined
  // (an inflated opponent rating would corrupt the honest player too).
  const eloAfter = new Map<string, { before: number; after: number }>();
  if (match.mode === "ranked" && match.season_id && !quarantined) {
    // Ratings were created when the players queued; the fallback covers
    // ranked matches born from challenge links where nobody queued.
    const seasonId = match.season_id;
    const ratings = await Promise.all(
      sides.map(
        async (s) =>
          (await store.getRating(s.studentId, match.subject_id, seasonId)) ??
          getOrCreateRating(
            store,
            s.studentId,
            match.subject_id,
            await getOrCreateSeason(store, now),
          ),
      ),
    );
    const scores: MatchOutcome[] =
      verdict.kind === "draw"
        ? [0.5, 0.5]
        : sides.map((s): MatchOutcome => (s.studentId === verdict.winnerId ? 1 : 0));

    for (let i = 0; i < sides.length; i++) {
      const mine = ratings[i];
      const theirs = ratings[1 - i];
      const after = updateElo(mine.elo, theirs.elo, scores[i]);
      eloAfter.set(sides[i].studentId, { before: mine.elo, after });
      await store.saveRating({
        ...mine,
        elo: after,
        matches_played: mine.matches_played + 1,
        wins: mine.wins + (scores[i] === 1 ? 1 : 0),
        losses: mine.losses + (scores[i] === 0 ? 1 : 0),
        draws: mine.draws + (scores[i] === 0.5 ? 1 : 0),
      });
    }
  }

  // Ledger + loss diagnostics feeding practice recommendations.
  const events = [];
  for (const side of sides) {
    const flagsJson = quarantinedSides.has(side.studentId);
    for (const row of answers.filter(
      (a) => a.student_id === side.studentId && a.answered_at !== null,
    )) {
      const question = questions.find((q) => q.id === row.question_id);
      if (!question) continue;
      const { elapsedMs, onTime } = elapsedWithinBudget(
        row.served_at,
        row.answered_at!,
        budgetMs,
      );
      events.push({
        userId: side.studentId,
        subjectId: match.subject_id,
        kind: "duel_answer" as const,
        payload: {
          matchId: match.id,
          questionId: row.question_id,
          topicId: question.topic_id,
          questionType: question.answer_type,
          correct: row.is_correct === true,
          elapsedMs,
          errorPattern:
            row.is_correct === true ? null : onTime ? "incorrect" : "timeout",
        } as Record<string, Json>,
        quarantined: flagsJson,
      });
      if (match.mode === "ranked" && row.is_correct !== true) {
        await store.addMistake(side.studentId, row.question_id, question.topic_id);
      }
    }
    const rating = eloAfter.get(side.studentId);
    events.push({
      userId: side.studentId,
      subjectId: match.subject_id,
      kind: "duel_result" as const,
      payload: {
        matchId: match.id,
        mode: match.mode,
        result:
          verdict.kind === "draw"
            ? "drew"
            : verdict.winnerId === side.studentId
              ? "won"
              : "lost",
        correct: side.correct,
        totalTimeMs: side.totalTimeMs,
        eloBefore: rating?.before ?? null,
        eloAfter: rating?.after ?? null,
      } as Record<string, Json>,
      quarantined: quarantinedSides.has(side.studentId),
    });
  }
  await store.appendEvents(events);
  await store.finishMatch(match.id);

  for (const side of sides) {
    const rating = eloAfter.get(side.studentId);
    const outcome =
      verdict.kind === "draw"
        ? "It's a draw"
        : verdict.winnerId === side.studentId
          ? "You won!"
          : "You lost";
    await store.notify({
      userId: side.studentId,
      category: "duels",
      title: `Duel finished — ${outcome}`,
      body: rating
        ? `Rating ${rating.before} → ${rating.after}`
        : undefined,
      href: `/duel/${match.id}`,
    });
  }
}

function optionsOf(question: DuelQuestion): string[] | null {
  if (question.answer_type !== "mcq") return null;
  const key = question.answer_key as { options?: unknown } | null;
  return Array.isArray(key?.options) ? (key.options as string[]) : null;
}

// ---------------------------------------------------------------
// Challenges: friend links and rematches
// ---------------------------------------------------------------

/**
 * Creates a challenge link. With an `opponentId` it's a direct (re)match
 * invitation and notifies them; without one it's an open link anyone can
 * claim — including someone who signs up from it (tracked by the caller).
 */
export async function createDuelChallenge(
  store: DuelStore,
  input: {
    creatorId: string;
    subjectId: string;
    mode: DuelMode;
    opponentId?: string | null;
    token: string;
    ipHash?: string | null;
  },
): Promise<{ token: string }> {
  const levelCode = await store.getStudentLevel(input.creatorId, input.subjectId);
  const challenge = await store.createChallenge({
    token: input.token,
    creatorId: input.creatorId,
    opponentId: input.opponentId ?? null,
    subjectId: input.subjectId,
    levelCode,
    mode: input.mode,
    creatorIpHash: input.ipHash ?? null,
  });
  if (input.opponentId) {
    await store.notify({
      userId: input.opponentId,
      category: "duels",
      title: "You've been challenged to a duel",
      href: `/duel/challenge/${challenge.token}`,
    });
  }
  return { token: challenge.token };
}

/**
 * Accepts a challenge: starts an ACTIVE match between creator and acceptor.
 * The creator is notified rather than assumed present — the match clock is
 * per-question from first serve, so a slow start costs neither player.
 */
export async function acceptDuelChallenge(
  store: DuelStore,
  input: { token: string; userId: string; ipHash?: string | null },
  now: Date,
): Promise<DuelMatch> {
  const challenge = await store.getChallengeByToken(input.token);
  if (!challenge) throw new DuelError("Challenge not found", 404);
  if (new Date(challenge.expires_at).getTime() < now.getTime()) {
    throw new DuelError("This challenge has expired", 410);
  }
  if (challenge.claimed_by) {
    throw new DuelError("This challenge was already accepted", 409);
  }
  if (challenge.creator_id === input.userId) {
    throw new DuelError("You can't accept your own challenge", 409);
  }
  if (challenge.opponent_id && challenge.opponent_id !== input.userId) {
    throw new DuelError("This challenge names someone else", 403);
  }
  // Two accounts on one network can spar, but never for rating.
  if (
    challenge.mode === "ranked" &&
    challenge.creator_ip_hash &&
    input.ipHash &&
    challenge.creator_ip_hash === input.ipHash
  ) {
    throw new DuelError(
      "Ranked challenges need different networks — play a friendly instead",
      403,
    );
  }

  const questionIds = await store.pickGradableQuestionIds(
    challenge.subject_id,
    MATCH_QUESTION_COUNT,
  );
  if (questionIds.length === 0) {
    throw new DuelError("No duel-ready questions for this subject yet.", 409);
  }

  const season =
    challenge.mode === "ranked" ? await getOrCreateSeason(store, now) : null;
  if (season) {
    // Both sides need season ratings before the match can settle.
    await getOrCreateRating(store, challenge.creator_id, challenge.subject_id, season);
    await getOrCreateRating(store, input.userId, challenge.subject_id, season);
  }

  const match = await store.createMatch({
    subjectId: challenge.subject_id,
    levelCode: challenge.level_code,
    mode: challenge.mode,
    seasonId: season?.id ?? null,
    studentAId: challenge.creator_id,
    studentBId: input.userId,
    questionIds,
    timeLimitSeconds: MATCH_TIME_LIMIT_SECONDS,
  });
  await store.claimChallenge(challenge.id, input.userId, match.id);
  await store.notify({
    userId: challenge.creator_id,
    category: "duels",
    title: "Your challenge was accepted — the duel is live",
    href: `/duel/${match.id}`,
  });
  return match;
}
