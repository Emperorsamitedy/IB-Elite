"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/actions/analytics";
import { getEntitlement, FREE_LIMITS } from "@/lib/subscription";
import type { ConfidenceRating, Difficulty, SessionMode } from "@/lib/types";

export type CreateSessionInput = {
  subjectId?: string | null;
  topicIds?: string[];
  difficulty?: Difficulty | null;
  count: number;
  timed?: boolean;
  minutesPerQuestion?: number;
  includeMistakes?: boolean;
  onlyBookmarked?: boolean;
  mode?: SessionMode;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Creates a practice session and redirects into it. */
export async function createSession(input: CreateSessionInput) {
  const user = await requireUser();
  const supabase = await createClient();

  // Free tier: a rolling 24h cap on questions started. The session is trimmed
  // to what's left rather than refused outright so a student with 3 questions
  // remaining can still use them.
  let maxQuestions = Math.max(1, input.count);
  const entitlement = await getEntitlement(user.id);
  if (!entitlement.isPro) {
    const usedToday = await practiceQuestionsUsedToday(user.id);
    const remaining = FREE_LIMITS.practiceQuestionsPerDay - usedToday;
    if (remaining <= 0) {
      return {
        error: `You've used your ${FREE_LIMITS.practiceQuestionsPerDay} free practice questions today. Upgrade to Pro for unlimited practice.`,
        limitReached: true,
      };
    }
    maxQuestions = Math.min(maxQuestions, remaining);
  }

  let query = supabase
    .from("questions")
    .select("id")
    .eq("status", "published");

  if (input.subjectId) query = query.eq("subject_id", input.subjectId);
  if (input.topicIds && input.topicIds.length > 0)
    query = query.in("topic_id", input.topicIds);
  if (input.difficulty) query = query.eq("difficulty", input.difficulty);

  // Restrict to bookmarked / mistaken questions when requested.
  if (input.onlyBookmarked) {
    const { data: bm } = await supabase
      .from("bookmarks")
      .select("question_id")
      .eq("user_id", user.id);
    const ids = (bm ?? []).map((b) => b.question_id);
    if (ids.length === 0) return { error: "You have no bookmarked questions." };
    query = query.in("id", ids);
  }
  if (input.includeMistakes) {
    const { data: mk } = await supabase
      .from("mistakes")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("resolved", false);
    const ids = (mk ?? []).map((m) => m.question_id);
    if (ids.length === 0) return { error: "You have no unresolved mistakes." };
    query = query.in("id", ids);
  }

  const { data: candidates, error } = await query.limit(500);
  if (error) return { error: error.message };
  if (!candidates || candidates.length === 0)
    return { error: "No questions match those filters yet." };

  const chosen = shuffle(candidates)
    .slice(0, maxQuestions)
    .map((c) => c.id);

  const timeLimit = input.timed
    ? chosen.length * (input.minutesPerQuestion ?? 2) * 60
    : null;

  const { data: session, error: sErr } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      subject_id: input.subjectId ?? null,
      mode: input.mode ?? "practice",
      difficulty: input.difficulty ?? null,
      topic_ids: input.topicIds ?? [],
      time_limit_seconds: timeLimit,
      total_questions: chosen.length,
    })
    .select("id")
    .single();

  if (sErr || !session) return { error: sErr?.message ?? "Could not start." };

  await supabase.from("practice_session_questions").insert(
    chosen.map((qid, i) => ({
      session_id: session.id,
      question_id: qid,
      position: i,
    })),
  );

  await logEvent("practice_session_started", {
    mode: input.mode ?? "practice",
    count: chosen.length,
  });

  redirect(`/session/${session.id}`);
}

/** Records the outcome of a single question within a session. */
export async function rateSessionQuestion(params: {
  sessionId: string;
  questionId: string;
  confidence: ConfidenceRating;
  timeSpent: number;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const isCorrect = params.confidence !== "wrong";

  await supabase
    .from("practice_session_questions")
    .update({
      confidence: params.confidence,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    })
    .eq("session_id", params.sessionId)
    .eq("question_id", params.questionId);

  await supabase.from("question_attempts").insert({
    user_id: user.id,
    question_id: params.questionId,
    session_id: params.sessionId,
    confidence: params.confidence,
    is_correct: isCorrect,
    time_spent_seconds: params.timeSpent,
  });

  // Maintain the mistake notebook automatically.
  if (params.confidence === "wrong" || params.confidence === "difficult") {
    const { data: q } = await supabase
      .from("questions")
      .select("topic_id")
      .eq("id", params.questionId)
      .single();
    await supabase.from("mistakes").upsert(
      {
        user_id: user.id,
        question_id: params.questionId,
        topic_id: q?.topic_id ?? null,
        resolved: false,
      },
      { onConflict: "user_id,question_id" },
    );
    await logEvent("question_marked_incorrect", {
      question_id: params.questionId,
    });
  }

  return { ok: true, isCorrect };
}

export async function setSessionProgress(sessionId: string, index: number) {
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from("practice_sessions")
    .update({ current_index: index })
    .eq("id", sessionId);
  return { ok: true };
}

export async function completeSession(sessionId: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from("practice_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  await logEvent("practice_session_completed", { session_id: sessionId });
  revalidatePath("/app");
  return { ok: true };
}

/** Questions this user has started in the last 24 hours, across sessions. */
export async function practiceQuestionsUsedToday(userId: string) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("practice_sessions")
    .select("total_questions")
    .eq("user_id", userId)
    .gte("created_at", since);
  return (data ?? []).reduce((sum, s) => sum + (s.total_questions ?? 0), 0);
}
