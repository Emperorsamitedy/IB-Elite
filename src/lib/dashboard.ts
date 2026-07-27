import "server-only";
import { createClient } from "@/lib/supabase/server";
import { estimateMinutes, gradeFromAccuracy } from "@/lib/utils";

export type TopicStat = {
  topicId: string;
  topicName: string;
  topicSlug: string;
  subjectSlug: string;
  subjectName: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type SubjectStanding = {
  subjectName: string;
  subjectSlug: string;
  attempts: number;
  accuracy: number;
  grade: number;
};

export type Recommendation = {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  topicId: string | null;
  topicName: string | null;
  count: number;
  estMinutes: number;
  reason: string;
};

export async function getDashboardData(userId: string) {
  const supabase = await createClient();

  const [userSubjectsRes, examsRes, sessionsRes, attemptsRes, mistakesRes] =
    await Promise.all([
      supabase
        .from("user_subjects")
        .select("subject_id, subjects(id, slug, name, group_name, color)")
        .eq("user_id", userId),
      supabase
        .from("exam_dates")
        .select("id, exam_date, subjects(name, slug)")
        .eq("user_id", userId)
        .gte("exam_date", new Date().toISOString().slice(0, 10))
        .order("exam_date"),
      supabase
        .from("practice_sessions")
        .select(
          "id, status, total_questions, current_index, created_at, subjects(name, slug)",
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("question_attempts")
        .select("is_correct, questions(topic_id, topics(name, slug, subjects(name, slug)))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("mistakes")
        .select(
          "question_id, created_at, questions(id, prompt, topics(name, slug, subjects(slug)))",
        )
        .eq("user_id", userId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // Aggregate topic performance.
  const topicMap = new Map<string, TopicStat>();
  for (const a of attemptsRes.data ?? []) {
    const q = a.questions as {
      topic_id: string;
      topics: {
        name: string;
        slug: string;
        subjects: { name: string; slug: string } | null;
      } | null;
    } | null;
    if (!q?.topic_id || !q.topics) continue;
    const existing = topicMap.get(q.topic_id) ?? {
      topicId: q.topic_id,
      topicName: q.topics.name,
      topicSlug: q.topics.slug,
      subjectSlug: q.topics.subjects?.slug ?? "",
      subjectName: q.topics.subjects?.name ?? "",
      attempts: 0,
      correct: 0,
      accuracy: 0,
    };
    existing.attempts += 1;
    if (a.is_correct) existing.correct += 1;
    topicMap.set(q.topic_id, existing);
  }
  const topicStats = [...topicMap.values()].map((t) => ({
    ...t,
    accuracy: t.attempts ? t.correct / t.attempts : 0,
  }));

  const weakTopics = topicStats
    .filter((t) => t.attempts >= 2 && t.accuracy < 0.7)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4);

  const totalAttempts = topicStats.reduce((s, t) => s + t.attempts, 0);
  const totalCorrect = topicStats.reduce((s, t) => s + t.correct, 0);

  // Per-subject standing on the IB 1–7 scale — drives the 7-gauge.
  const subjectAgg = new Map<
    string,
    { subjectName: string; subjectSlug: string; attempts: number; correct: number }
  >();
  for (const t of topicStats) {
    if (!t.subjectSlug) continue;
    const e = subjectAgg.get(t.subjectSlug) ?? {
      subjectName: t.subjectName,
      subjectSlug: t.subjectSlug,
      attempts: 0,
      correct: 0,
    };
    e.attempts += t.attempts;
    e.correct += t.correct;
    subjectAgg.set(t.subjectSlug, e);
  }
  const standings: SubjectStanding[] = [...subjectAgg.values()]
    .map((s) => {
      const accuracy = s.attempts ? s.correct / s.attempts : 0;
      return {
        subjectName: s.subjectName,
        subjectSlug: s.subjectSlug,
        attempts: s.attempts,
        accuracy,
        grade: gradeFromAccuracy(accuracy),
      };
    })
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 3);

  const subjects = (userSubjectsRes.data ?? [])
    .map((r) => r.subjects)
    .filter(Boolean) as {
    id: string;
    slug: string;
    name: string;
    group_name: string;
    color: string;
  }[];

  // Build a recommendation.
  let recommendation: Recommendation | null = null;
  if (weakTopics.length > 0) {
    const w = weakTopics[0];
    recommendation = {
      subjectId: "",
      subjectName: w.subjectName,
      subjectSlug: w.subjectSlug,
      topicId: w.topicId,
      topicName: w.topicName,
      count: 10,
      estMinutes: estimateMinutes(10),
      reason: `You're at ${Math.round(w.accuracy * 100)}% on ${w.topicName}. A short set will help.`,
    };
  } else if (subjects.length > 0) {
    const s = subjects[0];
    const { data: topic } = await supabase
      .from("topics")
      .select("id, name, slug")
      .eq("subject_id", s.id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    recommendation = {
      subjectId: s.id,
      subjectName: s.name,
      subjectSlug: s.slug,
      topicId: topic?.id ?? null,
      topicName: topic?.name ?? null,
      count: 15,
      estMinutes: estimateMinutes(15),
      reason: topic
        ? `Warm up with ${topic.name} in ${s.name}.`
        : `Start a ${s.name} session.`,
    };
  }

  return {
    subjects,
    standings,
    exams: examsRes.data ?? [],
    activeSessions: sessionsRes.data ?? [],
    weakTopics,
    recentMistakes: mistakesRes.data ?? [],
    recommendation,
    stats: {
      totalAttempts,
      totalCorrect,
      accuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
      unresolvedMistakes: (mistakesRes.data ?? []).length,
    },
    isNewUser: totalAttempts === 0 && subjects.length === 0,
  };
}
