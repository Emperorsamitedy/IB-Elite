import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StudyContext } from "@/lib/assistant";

type Client = SupabaseClient<Database>;

/**
 * What the assistant knows about the student regardless of which screen they
 * opened it from. Deliberately small: enough to be specific, cheap enough to
 * load on every message.
 */
export async function loadStudyContext(
  supabase: Client,
  userId: string,
): Promise<StudyContext> {
  const [subjectsRes, attemptsRes, mistakesRes] = await Promise.all([
    supabase
      .from("user_subjects")
      .select("subjects(name)")
      .eq("user_id", userId),
    supabase
      .from("question_attempts")
      .select("is_correct, questions(topics(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("mistakes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("resolved", false),
  ]);

  const subjects = (subjectsRes.data ?? [])
    .map((row) => (row.subjects as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  const perTopic = new Map<string, { attempts: number; correct: number }>();
  for (const attempt of attemptsRes.data ?? []) {
    const question = attempt.questions as {
      topics: { name: string } | null;
    } | null;
    const name = question?.topics?.name;
    if (!name) continue;
    const stat = perTopic.get(name) ?? { attempts: 0, correct: 0 };
    stat.attempts += 1;
    if (attempt.is_correct) stat.correct += 1;
    perTopic.set(name, stat);
  }

  const weakTopics = [...perTopic.entries()]
    .filter(([, s]) => s.attempts >= 2 && s.correct / s.attempts < 0.7)
    .sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts)
    .slice(0, 4)
    .map(([name]) => name);

  return {
    subjects,
    weakTopics,
    unresolvedMistakes: mistakesRes.count ?? 0,
  };
}
