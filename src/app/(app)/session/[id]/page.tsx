import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  SessionRunner,
  type Outcome,
  type SessionQuestion,
} from "@/components/session/session-runner";
import type { ConfidenceRating } from "@/lib/types";

export const metadata = { title: "Practice session" };

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("practice_sessions")
    .select("id, status, current_index, time_limit_seconds")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) notFound();

  const { data: rows } = await supabase
    .from("practice_session_questions")
    .select(
      `position,
       confidence,
       questions(
         id, title, prompt, answer, solution, difficulty, marks,
         question_type, calculator, year, paper, source, license,
         reviewer_name, reviewer_credential, reviewed_at,
         topics(name)
       )`,
    )
    .eq("session_id", id)
    .order("position");

  const questionIds = (rows ?? [])
    .map((r) => (r.questions as { id: string } | null)?.id)
    .filter((x): x is string => Boolean(x));

  const { data: bm } = await supabase
    .from("bookmarks")
    .select("question_id")
    .eq("user_id", user.id)
    .in("question_id", questionIds.length ? questionIds : ["_"]);
  const bookmarkedSet = new Set((bm ?? []).map((b) => b.question_id));

  const questions: SessionQuestion[] = (rows ?? [])
    .map((r) => r.questions as SessionQuestion | null)
    .filter((q): q is SessionQuestion => Boolean(q))
    .map((q) => ({ ...q, bookmarked: bookmarkedSet.has(q.id) }));

  if (questions.length === 0) redirect("/practice");

  const outcomes: Outcome[] = (rows ?? [])
    .map((r) => {
      const q = r.questions as { id: string } | null;
      if (!q || !r.confidence) return null;
      return {
        questionId: q.id,
        confidence: r.confidence as ConfidenceRating,
      };
    })
    .filter((o): o is Outcome => o !== null);

  return (
    <SessionRunner
      sessionId={session.id}
      questions={questions}
      startIndex={session.current_index}
      timeLimitSeconds={session.time_limit_seconds}
      initialOutcomes={outcomes}
      completed={session.status === "completed"}
    />
  );
}
