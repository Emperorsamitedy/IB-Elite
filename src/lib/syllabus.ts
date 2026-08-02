import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Difficulty } from "@/lib/types";

export type TopicNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  levelCode: string | null;
  subtopicCount: number;
  questionCount: number;
  attempted: number;
  accuracy: number | null;
  completion: number;
  lastPracticed: string | null;
  estimatedMinutes: number;
};

export type ThemeNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  levelCode: string | null;
  topics: TopicNode[];
};

export type SubjectRecord = {
  id: string;
  slug: string;
  name: string;
  group_name: string;
  description: string | null;
  color: string;
};

export type SubjectTree = {
  subject: SubjectRecord;
  themes: ThemeNode[];
  /** Topics that have not been filed under a theme yet. */
  looseTopics: TopicNode[];
  totals: { topics: number; questions: number; attempted: number };
};

/** Minutes a question is expected to take when no explicit estimate is stored. */
function questionMinutes(marks: number, estimate: number | null) {
  return estimate ?? Math.max(2, Math.round(marks * 1.5));
}

export async function getSubject(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("id, slug, name, group_name, description, color")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

/** Loads the full Subject → Theme → Topic tree with the user's progress. */
export async function getSubjectTree(
  subject: SubjectRecord,
  userId: string,
): Promise<SubjectTree> {
  const supabase = await createClient();

  const [{ data: themes }, { data: topics }, { data: questions }, { data: attempts }] =
    await Promise.all([
      supabase
        .from("themes")
        .select("id, slug, name, description, level_code, sort_order")
        .eq("subject_id", subject.id)
        .eq("status", "published")
        .order("sort_order"),
      supabase
        .from("topics")
        .select(
          "id, slug, name, description, level_code, theme_id, sort_order, estimated_minutes, subtopics(count)",
        )
        .eq("subject_id", subject.id)
        .eq("status", "published")
        .order("sort_order"),
      supabase
        .from("questions")
        .select("id, topic_id, marks, estimated_minutes")
        .eq("subject_id", subject.id)
        .eq("status", "published")
        .limit(5000),
      supabase
        .from("question_attempts")
        .select("question_id, is_correct, created_at, questions!inner(topic_id, subject_id)")
        .eq("user_id", userId)
        .eq("questions.subject_id", subject.id)
        .limit(5000),
    ]);

  const perTopic = new Map<
    string,
    { count: number; minutes: number; ids: Set<string> }
  >();
  for (const q of questions ?? []) {
    const entry = perTopic.get(q.topic_id) ?? {
      count: 0,
      minutes: 0,
      ids: new Set<string>(),
    };
    entry.count += 1;
    entry.minutes += questionMinutes(q.marks, q.estimated_minutes);
    entry.ids.add(q.id);
    perTopic.set(q.topic_id, entry);
  }

  const progress = new Map<
    string,
    { total: number; correct: number; seen: Set<string>; last: string | null }
  >();
  for (const a of attempts ?? []) {
    const q = a.questions as { topic_id: string } | null;
    if (!q) continue;
    const entry = progress.get(q.topic_id) ?? {
      total: 0,
      correct: 0,
      seen: new Set<string>(),
      last: null,
    };
    entry.total += 1;
    if (a.is_correct) entry.correct += 1;
    entry.seen.add(a.question_id);
    if (!entry.last || a.created_at > entry.last) entry.last = a.created_at;
    progress.set(q.topic_id, entry);
  }

  const nodes: TopicNode[] = (topics ?? []).map((t) => {
    const q = perTopic.get(t.id);
    const p = progress.get(t.id);
    const questionCount = q?.count ?? 0;
    const attempted = p?.seen.size ?? 0;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      levelCode: t.level_code,
      subtopicCount: (t.subtopics as { count: number }[])?.[0]?.count ?? 0,
      questionCount,
      attempted,
      accuracy: p && p.total ? p.correct / p.total : null,
      completion: questionCount ? Math.min(1, attempted / questionCount) : 0,
      lastPracticed: p?.last ?? null,
      estimatedMinutes: t.estimated_minutes ?? q?.minutes ?? 0,
    };
  });

  const byTheme = new Map<string, TopicNode[]>();
  const loose: TopicNode[] = [];
  (topics ?? []).forEach((t, i) => {
    const node = nodes[i];
    if (t.theme_id) {
      byTheme.set(t.theme_id, [...(byTheme.get(t.theme_id) ?? []), node]);
    } else {
      loose.push(node);
    }
  });

  return {
    subject,
    themes: (themes ?? []).map((th) => ({
      id: th.id,
      slug: th.slug,
      name: th.name,
      description: th.description,
      levelCode: th.level_code,
      topics: byTheme.get(th.id) ?? [],
    })),
    looseTopics: loose,
    totals: {
      topics: nodes.length,
      questions: nodes.reduce((sum, n) => sum + n.questionCount, 0),
      attempted: nodes.reduce((sum, n) => sum + n.attempted, 0),
    },
  };
}

export async function getTopicName(subjectId: string, topicSlug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("topics")
    .select("name")
    .eq("subject_id", subjectId)
    .eq("slug", topicSlug)
    .maybeSingle();
  return data?.name ?? null;
}

export type TopicQuestion = {
  id: string;
  title: string | null;
  prompt: string;
  difficulty: Difficulty;
  marks: number;
  paper: string | null;
  year: number | null;
  calculator: boolean | null;
  questionType: string;
  questionNumber: string | null;
  subtopicId: string | null;
  subtopicName: string | null;
  estimatedMinutes: number;
  createdAt: string;
  attemptCount: number;
  bookmarkCount: number;
  attempted: boolean;
  correct: boolean | null;
};

export type TopicDetail = {
  topic: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    levelCode: string | null;
  };
  theme: { id: string; slug: string; name: string } | null;
  subtopics: { id: string; slug: string; name: string; questionCount: number }[];
  questions: TopicQuestion[];
  stats: {
    questionCount: number;
    attempted: number;
    accuracy: number | null;
    completion: number;
    estimatedMinutes: number;
    weakSubtopic: string | null;
  };
  facets: { papers: string[]; years: number[]; types: string[] };
};

/** Loads a single topic with its subtopics, questions and the user's progress. */
export async function getTopicDetail(
  subjectId: string,
  topicSlug: string,
  userId: string,
): Promise<TopicDetail | null> {
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select(
      "id, slug, name, description, level_code, themes(id, slug, name)",
    )
    .eq("subject_id", subjectId)
    .eq("slug", topicSlug)
    .maybeSingle();
  if (!topic) return null;

  const [{ data: subtopics }, { data: rows }, { data: attempts }, { data: bookmarks }] =
    await Promise.all([
      supabase
        .from("subtopics")
        .select("id, slug, name, sort_order")
        .eq("topic_id", topic.id)
        .eq("status", "published")
        .order("sort_order"),
      supabase
        .from("questions")
        .select(
          "id, title, prompt, difficulty, marks, paper, year, calculator, question_type, question_number, estimated_minutes, created_at, subtopic_id, subtopics(name)",
        )
        .eq("topic_id", topic.id)
        .eq("status", "published")
        .limit(2000),
      supabase
        .from("question_attempts")
        .select("question_id, is_correct, user_id, questions!inner(topic_id)")
        .eq("questions.topic_id", topic.id)
        .limit(5000),
      supabase
        .from("bookmarks")
        .select("question_id, questions!inner(topic_id)")
        .eq("questions.topic_id", topic.id)
        .limit(5000),
    ]);

  const attemptCounts = new Map<string, number>();
  const bookmarkCounts = new Map<string, number>();
  const mine = new Map<string, { total: number; correct: number }>();
  for (const a of attempts ?? []) {
    attemptCounts.set(a.question_id, (attemptCounts.get(a.question_id) ?? 0) + 1);
    if (a.user_id === userId) {
      const m = mine.get(a.question_id) ?? { total: 0, correct: 0 };
      m.total += 1;
      if (a.is_correct) m.correct += 1;
      mine.set(a.question_id, m);
    }
  }
  for (const b of bookmarks ?? []) {
    bookmarkCounts.set(b.question_id, (bookmarkCounts.get(b.question_id) ?? 0) + 1);
  }

  const questions: TopicQuestion[] = (rows ?? []).map((q) => {
    const m = mine.get(q.id);
    return {
      id: q.id,
      title: q.title,
      prompt: q.prompt,
      difficulty: q.difficulty,
      marks: q.marks,
      paper: q.paper,
      year: q.year,
      calculator: q.calculator,
      questionType: q.question_type,
      questionNumber: q.question_number,
      subtopicId: q.subtopic_id,
      subtopicName: (q.subtopics as { name: string } | null)?.name ?? null,
      estimatedMinutes: questionMinutes(q.marks, q.estimated_minutes),
      createdAt: q.created_at,
      attemptCount: attemptCounts.get(q.id) ?? 0,
      bookmarkCount: bookmarkCounts.get(q.id) ?? 0,
      attempted: Boolean(m),
      correct: m ? m.correct > 0 : null,
    };
  });

  const perSubtopic = new Map<string, { total: number; correct: number }>();
  for (const q of questions) {
    if (!q.subtopicId || !q.attempted) continue;
    const s = perSubtopic.get(q.subtopicId) ?? { total: 0, correct: 0 };
    s.total += 1;
    if (q.correct) s.correct += 1;
    perSubtopic.set(q.subtopicId, s);
  }
  let weakSubtopic: string | null = null;
  let worst = 1;
  for (const [id, s] of perSubtopic) {
    const acc = s.correct / s.total;
    if (s.total >= 2 && acc < worst) {
      worst = acc;
      weakSubtopic = (subtopics ?? []).find((st) => st.id === id)?.name ?? null;
    }
  }

  const attemptedCount = questions.filter((q) => q.attempted).length;
  const myTotal = [...mine.values()].reduce((s, m) => s + m.total, 0);
  const myCorrect = [...mine.values()].reduce((s, m) => s + m.correct, 0);

  return {
    topic: {
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      levelCode: topic.level_code,
    },
    theme: (topic.themes as { id: string; slug: string; name: string } | null) ?? null,
    subtopics: (subtopics ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      questionCount: questions.filter((q) => q.subtopicId === s.id).length,
    })),
    questions,
    stats: {
      questionCount: questions.length,
      attempted: attemptedCount,
      accuracy: myTotal ? myCorrect / myTotal : null,
      completion: questions.length ? attemptedCount / questions.length : 0,
      estimatedMinutes: questions.reduce((s, q) => s + q.estimatedMinutes, 0),
      weakSubtopic,
    },
    facets: {
      papers: [...new Set(questions.map((q) => q.paper).filter((p): p is string => !!p))].sort(),
      years: [...new Set(questions.map((q) => q.year).filter((y): y is number => !!y))].sort((a, b) => b - a),
      types: [...new Set(questions.map((q) => q.questionType))].sort(),
    },
  };
}
