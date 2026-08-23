import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  LadderStore,
  LeaderboardFilter,
  LeaderboardIdentity,
} from "./store";
import type {
  LadderLeaderboardRow,
  LadderMatch,
  LadderProgress,
  LevelCode,
} from "./types";

const MATCH_COLUMNS =
  "id, subject_id, paper_ref, paper_year, question_ids, level_code, student_a_id, student_b_id, status, started_at, ended_at";
const PROGRESS_COLUMNS =
  "id, match_id, student_id, current_question_index, correct_count, final_score, is_complete, last_updated_at";
const LEADERBOARD_COLUMNS =
  "id, student_id, country, school, wins, losses, updated_at";

type AdminClient = ReturnType<typeof createAdminClient>;

function asMatch(row: {
  level_code: string;
  status: string;
} & Omit<LadderMatch, "level_code" | "status">): LadderMatch {
  return {
    ...row,
    level_code: row.level_code === "HL" ? "HL" : "SL",
    status:
      row.status === "ACTIVE"
        ? "ACTIVE"
        : row.status === "COMPLETE"
          ? "COMPLETE"
          : "WAITING",
  };
}

/** Writes go through the service role so a player cannot forge the other side. */
export function createSupabaseLadderStore(
  client: AdminClient = createAdminClient(),
): LadderStore {
  return {
    async getStudentLevel(studentId: string, subjectId: string): Promise<LevelCode> {
      const { data } = await client
        .from("user_subjects")
        .select("levels(code)")
        .eq("user_id", studentId)
        .eq("subject_id", subjectId)
        .maybeSingle();
      const level = Array.isArray(data?.levels) ? data?.levels[0] : data?.levels;
      return level?.code === "HL" ? "HL" : "SL";
    },

    async pickQuestionIds(subjectId, count) {
      // The bank is small enough to sample in memory; cap the fetch anyway.
      const { data, error } = await client
        .from("questions")
        .select("id")
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .limit(500);
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((q) => q.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.slice(0, count);
    },

    async findWaitingMatch(subjectId, level, studentId) {
      const { data } = await client
        .from("ladder_matches")
        .select(MATCH_COLUMNS)
        .eq("subject_id", subjectId)
        .eq("level_code", level)
        .eq("status", "WAITING")
        .is("student_b_id", null)
        .neq("student_a_id", studentId)
        .order("created_at")
        .limit(1);
      const row = data?.[0];
      return row ? asMatch(row) : null;
    },

    async createWaitingMatch(input) {
      const { data, error } = await client
        .from("ladder_matches")
        .insert({
          subject_id: input.subjectId,
          level_code: input.level,
          student_a_id: input.studentId,
          paper_ref: input.paperRef,
          paper_year: input.paperYear,
          question_ids: input.questionIds,
          status: "WAITING",
        })
        .select(MATCH_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      await client
        .from("ladder_progress")
        .insert({ match_id: data.id, student_id: input.studentId });
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
      await client
        .from("ladder_progress")
        .insert({ match_id: matchId, student_id: studentId });
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

    async upsertProgress(input): Promise<LadderProgress> {
      const { data, error } = await client
        .from("ladder_progress")
        .upsert(
          {
            match_id: input.matchId,
            student_id: input.studentId,
            current_question_index: input.questionIndex,
            correct_count: input.correctCount,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "match_id,student_id" },
        )
        .select(PROGRESS_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async completeSide(input): Promise<LadderProgress> {
      const { data, error } = await client
        .from("ladder_progress")
        .upsert(
          {
            match_id: input.matchId,
            student_id: input.studentId,
            final_score: input.finalScore,
            is_complete: true,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "match_id,student_id" },
        )
        .select(PROGRESS_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async listProgress(matchId): Promise<LadderProgress[]> {
      const { data } = await client
        .from("ladder_progress")
        .select(PROGRESS_COLUMNS)
        .eq("match_id", matchId)
        .order("student_id");
      return data ?? [];
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

    async saveIdentity(
      studentId: string,
      identity: LeaderboardIdentity,
    ): Promise<LadderLeaderboardRow> {
      const { data: existing } = await client
        .from("ladder_leaderboard")
        .select(LEADERBOARD_COLUMNS)
        .eq("student_id", studentId)
        .maybeSingle();

      const { data, error } = await client
        .from("ladder_leaderboard")
        .upsert(
          {
            student_id: studentId,
            country: identity.country ?? existing?.country ?? null,
            school: identity.school ?? existing?.school ?? null,
            wins: existing?.wins ?? 0,
            losses: existing?.losses ?? 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id" },
        )
        .select(LEADERBOARD_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async recordResult({
      studentId,
      won,
      drew,
    }: {
      studentId: string;
      won: boolean;
      drew: boolean;
    }): Promise<LadderLeaderboardRow> {
      const { data: existing } = await client
        .from("ladder_leaderboard")
        .select(LEADERBOARD_COLUMNS)
        .eq("student_id", studentId)
        .maybeSingle();

      const wins = (existing?.wins ?? 0) + (won ? 1 : 0);
      const losses = (existing?.losses ?? 0) + (!won && !drew ? 1 : 0);

      const { data, error } = await client
        .from("ladder_leaderboard")
        .upsert(
          {
            student_id: studentId,
            country: existing?.country ?? null,
            school: existing?.school ?? null,
            wins,
            losses,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id" },
        )
        .select(LEADERBOARD_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async leaderboard(filter: LeaderboardFilter): Promise<LadderLeaderboardRow[]> {
      let query = client
        .from("ladder_leaderboard")
        .select(LEADERBOARD_COLUMNS)
        .order("wins", { ascending: false })
        .limit(filter.limit ?? 50);
      if (filter.country) query = query.eq("country", filter.country);
      if (filter.school) query = query.eq("school", filter.school);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };
}
