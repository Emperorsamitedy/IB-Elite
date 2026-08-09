import { createClient } from "@/lib/supabase/server";
import { buildPlan, eachDay, toDateKey } from "./plan";
import {
  DEFAULT_DAILY_CAP_MINUTES,
  WEAK_MASTERY_THRESHOLD,
  type Deadline,
  type DeadlineType,
  type LevelCode,
  type StudentSubject,
  type StudyBlockDraft,
  type TopicMastery,
} from "./types";

export { buildPlan, eachDay, toDateKey };
export * from "./types";

export type StudyBlock = {
  id: string;
  student_id: string;
  date: string;
  subject_id: string | null;
  topic_id: string | null;
  deadline_id: string | null;
  allocated_minutes: number;
  is_locked: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function today(): string {
  return toDateKey(new Date());
}

async function loadSubjects(
  supabase: SupabaseServerClient,
  studentId: string,
): Promise<StudentSubject[]> {
  const { data } = await supabase
    .from("user_subjects")
    .select("subject_id, levels(code)")
    .eq("user_id", studentId);

  return (data ?? []).map((row) => {
    const level = Array.isArray(row.levels) ? row.levels[0] : row.levels;
    return {
      subjectId: row.subject_id,
      level: (level?.code === "HL" ? "HL" : "SL") as LevelCode,
    };
  });
}

/**
 * The schema has no mastery column, so proficiency is derived from attempts:
 * correct / attempted per topic. Topics with no attempts count as weak.
 */
async function loadTopicMastery(
  supabase: SupabaseServerClient,
  studentId: string,
  subjectIds: string[],
  forcedWeakTopicId?: string,
): Promise<TopicMastery[]> {
  if (subjectIds.length === 0) return [];

  const [{ data: topics }, { data: attempts }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, subject_id")
      .in("subject_id", subjectIds)
      .eq("status", "published"),
    supabase
      .from("question_attempts")
      .select("is_correct, questions(topic_id)")
      .eq("user_id", studentId),
  ]);

  const tally = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts ?? []) {
    const question = Array.isArray(attempt.questions)
      ? attempt.questions[0]
      : attempt.questions;
    const topicId = question?.topic_id;
    if (!topicId) continue;
    const entry = tally.get(topicId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (attempt.is_correct) entry.correct += 1;
    tally.set(topicId, entry);
  }

  return (topics ?? []).map((topic) => {
    const entry = tally.get(topic.id);
    const mastery =
      topic.id === forcedWeakTopicId || !entry || entry.total === 0
        ? 0
        : entry.correct / entry.total;
    return { topicId: topic.id, subjectId: topic.subject_id, mastery };
  });
}

async function loadDeadlines(
  supabase: SupabaseServerClient,
  studentId: string,
): Promise<Deadline[]> {
  const { data } = await supabase
    .from("deadlines")
    .select("id, type, subject_id, due_date, title")
    .eq("student_id", studentId)
    .order("due_date");

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type as DeadlineType,
    subjectId: row.subject_id,
    dueDate: row.due_date,
    title: row.title,
  }));
}

function toRows(studentId: string, drafts: StudyBlockDraft[]) {
  return drafts.map((draft) => ({
    student_id: studentId,
    date: draft.date,
    subject_id: draft.subjectId,
    topic_id: draft.topicId,
    deadline_id: draft.deadlineId,
    allocated_minutes: draft.allocatedMinutes,
    is_locked: false,
  }));
}

export type GenerateOptions = {
  dailyCapMinutes?: number;
  /** Keep locked blocks and only replace unlocked ones from today forward. */
  preserveLocked?: boolean;
  forcedWeakTopicId?: string;
};

async function writePlan(
  supabase: SupabaseServerClient,
  studentId: string,
  examDate: string,
  options: GenerateOptions,
): Promise<StudyBlock[]> {
  const from = today();
  const subjects = await loadSubjects(supabase, studentId);
  const [topics, deadlines] = await Promise.all([
    loadTopicMastery(
      supabase,
      studentId,
      subjects.map((s) => s.subjectId),
      options.forcedWeakTopicId,
    ),
    loadDeadlines(supabase, studentId),
  ]);

  const { data: existing } = await supabase
    .from("study_blocks")
    .select("date, allocated_minutes, is_locked")
    .eq("student_id", studentId)
    .gte("date", from);

  const reservedMinutesByDate: Record<string, number> = {};
  for (const block of existing ?? []) {
    if (!block.is_locked) continue;
    reservedMinutesByDate[block.date] =
      (reservedMinutesByDate[block.date] ?? 0) + block.allocated_minutes;
  }

  // Only unlocked blocks from today forward are replaced.
  let deleteQuery = supabase
    .from("study_blocks")
    .delete()
    .eq("student_id", studentId)
    .gte("date", from);
  if (options.preserveLocked !== false) {
    deleteQuery = deleteQuery.eq("is_locked", false);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw new Error(deleteError.message);

  const drafts = buildPlan({
    subjects,
    topics,
    deadlines,
    startDate: from,
    examDate,
    dailyCapMinutes: options.dailyCapMinutes ?? DEFAULT_DAILY_CAP_MINUTES,
    reservedMinutesByDate,
  });

  if (drafts.length === 0) return [];

  const { data, error } = await supabase
    .from("study_blocks")
    .insert(toRows(studentId, drafts))
    .select(
      "id, student_id, date, subject_id, topic_id, deadline_id, allocated_minutes, is_locked",
    );
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function generatePlan(
  studentId: string,
  examDate: string,
  options: GenerateOptions = {},
): Promise<StudyBlock[]> {
  const supabase = await createClient();
  return writePlan(supabase, studentId, examDate, options);
}

/**
 * Treats `topicId` as newly weak and regenerates only the future, unlocked
 * blocks; anything before today or locked is left untouched.
 */
export async function rebalancePlan(
  studentId: string,
  topicId: string,
  options: GenerateOptions = {},
): Promise<StudyBlock[]> {
  const supabase = await createClient();
  const { data: horizon } = await supabase
    .from("study_blocks")
    .select("date")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .limit(1);

  const examDate = horizon?.[0]?.date;
  if (!examDate || examDate < today()) return [];

  return writePlan(supabase, studentId, examDate, {
    ...options,
    forcedWeakTopicId: topicId,
    preserveLocked: true,
  });
}

export async function getSchedule(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_blocks")
    .select(
      "id, student_id, date, subject_id, topic_id, deadline_id, allocated_minutes, is_locked",
    )
    .eq("student_id", studentId)
    .gte("date", today())
    .order("date");
  if (error) throw new Error(error.message);

  const byDate: Record<string, StudyBlock[]> = {};
  for (const block of data ?? []) {
    (byDate[block.date] ??= []).push(block);
  }
  return byDate;
}

export async function setBlockLock(blockId: string, isLocked: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_blocks")
    .update({ is_locked: isLocked })
    .eq("id", blockId)
    .select(
      "id, student_id, date, subject_id, topic_id, deadline_id, allocated_minutes, is_locked",
    )
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export { WEAK_MASTERY_THRESHOLD };
