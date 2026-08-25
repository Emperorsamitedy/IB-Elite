import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  isDuelGradable,
  preferRobustPool,
  type AnswerType,
} from "./answers";
import type {
  Challenge,
  DuelMatch,
  DuelQuestion,
  DuelStore,
  MatchAnswerRow,
  QueueRow,
} from "./store";
import type { LevelCode } from "./store";

const MATCH_COLUMNS =
  "id, subject_id, level_code, mode, season_id, question_ids, student_a_id, student_b_id, status, time_limit_seconds, started_at, ended_at";
const ANSWER_COLUMNS =
  "id, match_id, student_id, question_id, question_index, answer, is_correct, served_at, answered_at";
const CHALLENGE_COLUMNS =
  "id, token, creator_id, opponent_id, subject_id, level_code, mode, match_id, claimed_by, creator_ip_hash, expires_at";

type AdminClient = ReturnType<typeof createAdminClient>;

function asLevel(code: string): LevelCode {
  return code === "HL" ? "HL" : "SL";
}

function asMatch(row: Record<string, unknown>): DuelMatch {
  const r = row as DuelMatch & { level_code: string; mode: string; status: string };
  return {
    ...r,
    level_code: asLevel(r.level_code),
    mode: r.mode === "friendly" ? "friendly" : "ranked",
    status:
      r.status === "ACTIVE"
        ? "ACTIVE"
        : r.status === "COMPLETE"
          ? "COMPLETE"
          : "WAITING",
  };
}

/** Writes go through the service role; ratings and timing are never client-writable. */
export function createSupabaseDuelStore(
  client: AdminClient = createAdminClient(),
): DuelStore {
  return {
    async getSeasonBySlug(slug) {
      const { data } = await client
        .from("seasons")
        .select("id, slug, starts_at, ends_at")
        .eq("slug", slug)
        .maybeSingle();
      return data ?? null;
    },

    async createSeason(slug, startsAt, endsAt) {
      const { data, error } = await client
        .from("seasons")
        .upsert(
          { slug, starts_at: startsAt, ends_at: endsAt },
          { onConflict: "slug" },
        )
        .select("id, slug, starts_at, ends_at")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async getRating(userId, subjectId, seasonId) {
      const { data } = await client
        .from("subject_ratings")
        .select(
          "user_id, subject_id, season_id, elo, matches_played, wins, losses, draws",
        )
        .eq("user_id", userId)
        .eq("subject_id", subjectId)
        .eq("season_id", seasonId)
        .maybeSingle();
      return data ?? null;
    },

    async saveRating(rating) {
      const { error } = await client.from("subject_ratings").upsert({
        ...rating,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },

    async getStudentLevel(userId, subjectId) {
      const { data } = await client
        .from("user_subjects")
        .select("levels(code)")
        .eq("user_id", userId)
        .eq("subject_id", subjectId)
        .maybeSingle();
      const level = Array.isArray(data?.levels) ? data?.levels[0] : data?.levels;
      return asLevel((level as { code?: string } | null)?.code ?? "SL");
    },

    async enqueue(row) {
      const { data, error } = await client
        .from("duel_queue")
        .upsert(
          {
            user_id: row.user_id,
            subject_id: row.subject_id,
            level_code: row.level_code,
            elo: row.elo,
            mode: row.mode,
            ip_hash: row.ip_hash,
            enqueued_at: new Date().toISOString(),
          },
          { onConflict: "user_id,subject_id" },
        )
        .select("user_id, subject_id, level_code, elo, mode, ip_hash, enqueued_at")
        .single();
      if (error) throw new Error(error.message);
      return { ...data, level_code: asLevel(data.level_code) } as QueueRow;
    },

    async dequeue(userId, subjectId) {
      await client
        .from("duel_queue")
        .delete()
        .eq("user_id", userId)
        .eq("subject_id", subjectId);
    },

    async listQueue(subjectId, levelCode, mode) {
      const { data } = await client
        .from("duel_queue")
        .select("user_id, subject_id, level_code, elo, mode, ip_hash, enqueued_at")
        .eq("subject_id", subjectId)
        .eq("level_code", levelCode)
        .eq("mode", mode)
        .order("enqueued_at");
      return (data ?? []).map((row) => ({
        ...row,
        level_code: asLevel(row.level_code),
      })) as QueueRow[];
    },

    async pickGradableQuestionIds(subjectId, count) {
      const { data, error } = await client
        .from("questions")
        .select("id, answer_type, answer_key")
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .neq("answer_type", "free")
        .limit(500);
      if (error) throw new Error(error.message);
      const gradable = (data ?? []).filter((q) =>
        isDuelGradable(q.answer_type, q.answer_key),
      );
      return preferRobustPool(gradable, count, (items) => {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      });
    },

    async createMatch(input) {
      const { data, error } = await client
        .from("ladder_matches")
        .insert({
          subject_id: input.subjectId,
          level_code: input.levelCode,
          mode: input.mode,
          season_id: input.seasonId,
          student_a_id: input.studentAId,
          student_b_id: input.studentBId,
          question_ids: input.questionIds,
          time_limit_seconds: input.timeLimitSeconds,
          status: input.studentBId ? "ACTIVE" : "WAITING",
          started_at: input.studentBId ? new Date().toISOString() : null,
        })
        .select(MATCH_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asMatch(data);
    },

    async joinMatch(matchId, studentId) {
      // Guarded on student_b_id being null so two joiners cannot both win.
      const { data, error } = await client
        .from("ladder_matches")
        .update({
          student_b_id: studentId,
          status: "ACTIVE",
          started_at: new Date().toISOString(),
        })
        .eq("id", matchId)
        .is("student_b_id", null)
        .select(MATCH_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asMatch(data);
    },

    async getMatch(matchId) {
      const { data } = await client
        .from("ladder_matches")
        .select(MATCH_COLUMNS)
        .eq("id", matchId)
        .maybeSingle();
      return data ? asMatch(data) : null;
    },

    async finishMatch(matchId) {
      const { data, error } = await client
        .from("ladder_matches")
        .update({ status: "COMPLETE", ended_at: new Date().toISOString() })
        .eq("id", matchId)
        .select(MATCH_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asMatch(data);
    },

    async getQuestions(ids) {
      const { data, error } = await client
        .from("questions")
        .select(
          "id, topic_id, title, prompt, marks, difficulty, answer_type, answer_key",
        )
        .in("id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []).map((q) => ({
        ...q,
        answer_type: q.answer_type as AnswerType,
      })) as DuelQuestion[];
    },

    async recordServe(matchId, studentId, questionId, questionIndex) {
      // Insert-if-absent: a re-poll must never restart the clock.
      const { data: existing } = await client
        .from("match_answers")
        .select(ANSWER_COLUMNS)
        .eq("match_id", matchId)
        .eq("student_id", studentId)
        .eq("question_index", questionIndex)
        .maybeSingle();
      if (existing) return existing as MatchAnswerRow;

      const { data, error } = await client
        .from("match_answers")
        .upsert(
          {
            match_id: matchId,
            student_id: studentId,
            question_id: questionId,
            question_index: questionIndex,
          },
          { onConflict: "match_id,student_id,question_index", ignoreDuplicates: true },
        )
        .select(ANSWER_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as MatchAnswerRow;
      // Lost a race with a concurrent poll — read the winner's row.
      const { data: raced } = await client
        .from("match_answers")
        .select(ANSWER_COLUMNS)
        .eq("match_id", matchId)
        .eq("student_id", studentId)
        .eq("question_index", questionIndex)
        .single();
      return raced as MatchAnswerRow;
    },

    async recordAnswer(answerId, answer, isCorrect, answeredAt) {
      // Guarded on answered_at being null: an answer can never be rewritten.
      const { data, error } = await client
        .from("match_answers")
        .update({ answer, is_correct: isCorrect, answered_at: answeredAt })
        .eq("id", answerId)
        .is("answered_at", null)
        .select(ANSWER_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return data as MatchAnswerRow;
    },

    async listAnswers(matchId) {
      const { data } = await client
        .from("match_answers")
        .select(ANSWER_COLUMNS)
        .eq("match_id", matchId)
        .order("question_index");
      return (data ?? []) as MatchAnswerRow[];
    },

    async countRecentRankedMatches(userA, userB, sinceIso) {
      const { count } = await client
        .from("ladder_matches")
        .select("id", { count: "exact", head: true })
        .eq("mode", "ranked")
        .gte("created_at", sinceIso)
        .or(
          `and(student_a_id.eq.${userA},student_b_id.eq.${userB}),and(student_a_id.eq.${userB},student_b_id.eq.${userA})`,
        );
      return count ?? 0;
    },

    async appendEvents(events) {
      if (events.length === 0) return;
      const { error } = await client.from("performance_events").insert(
        events.map((e) => ({
          user_id: e.userId,
          subject_id: e.subjectId,
          kind: e.kind,
          payload: e.payload,
          integrity_flags: (e.integrityFlags ?? []) as Json,
          quarantined: e.quarantined ?? false,
        })),
      );
      if (error) throw new Error(error.message);
    },

    async historyAccuracy(userId, subjectId) {
      const { data } = await client
        .from("performance_events")
        .select("payload")
        .eq("user_id", userId)
        .eq("subject_id", subjectId)
        .eq("kind", "duel_answer")
        .eq("quarantined", false)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = data ?? [];
      if (rows.length < 10) return null;
      const correct = rows.filter(
        (r) => (r.payload as { correct?: boolean }).correct === true,
      ).length;
      return correct / rows.length;
    },

    async createIntegrityReview(input) {
      const { error } = await client.from("integrity_reviews").insert({
        user_id: input.userId,
        source_kind: input.sourceKind,
        source_id: input.sourceId,
        reason: input.reason,
        details: input.details,
      });
      if (error) throw new Error(error.message);
    },

    async addMistake(userId, questionId, topicId) {
      await client.from("mistakes").upsert(
        {
          user_id: userId,
          question_id: questionId,
          topic_id: topicId,
          resolved: false,
        },
        { onConflict: "user_id,question_id", ignoreDuplicates: true },
      );
    },

    async notify(input) {
      // A row in notification_optouts means "don't send this category".
      const { data: optout } = await client
        .from("notification_optouts")
        .select("category")
        .eq("user_id", input.userId)
        .eq("category", input.category)
        .maybeSingle();
      if (optout) return;
      await client.from("notifications").insert({
        user_id: input.userId,
        category: input.category,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      });
    },

    async createChallenge(input) {
      const { data, error } = await client
        .from("duel_challenges")
        .insert({
          token: input.token,
          creator_id: input.creatorId,
          opponent_id: input.opponentId,
          subject_id: input.subjectId,
          level_code: input.levelCode,
          mode: input.mode,
          creator_ip_hash: input.creatorIpHash,
        })
        .select(CHALLENGE_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return { ...data, level_code: asLevel(data.level_code) } as Challenge;
    },

    async getChallengeByToken(token) {
      const { data } = await client
        .from("duel_challenges")
        .select(CHALLENGE_COLUMNS)
        .eq("token", token)
        .maybeSingle();
      return data
        ? ({ ...data, level_code: asLevel(data.level_code) } as Challenge)
        : null;
    },

    async claimChallenge(challengeId, userId, matchId) {
      const { error } = await client
        .from("duel_challenges")
        .update({ claimed_by: userId, match_id: matchId })
        .eq("id", challengeId)
        .is("claimed_by", null);
      if (error) throw new Error(error.message);
    },
  };
}
