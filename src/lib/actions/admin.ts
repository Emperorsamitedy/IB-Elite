"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus } from "@/lib/types";

const questionSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid(),
  levelId: z.string().uuid().nullable().optional(),
  subtopicId: z.string().uuid().nullable().optional(),
  questionNumber: z.string().max(40).nullable().optional(),
  tags: z.array(z.string()).optional(),
  estimatedMinutes: z.number().int().min(1).max(240).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  prompt: z.string().min(3),
  answer: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.number().int().min(0).max(100),
  questionType: z.string().min(1),
  calculator: z.boolean().nullable().optional(),
  year: z.number().int().nullable().optional(),
  paper: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]),
});

export type QuestionFormValues = z.infer<typeof questionSchema>;

function toRow(v: QuestionFormValues) {
  return {
    subject_id: v.subjectId,
    topic_id: v.topicId,
    level_id: v.levelId ?? null,
    subtopic_id: v.subtopicId ?? null,
    question_number: v.questionNumber ?? null,
    tags: v.tags ?? [],
    estimated_minutes: v.estimatedMinutes ?? null,
    title: v.title ?? null,
    prompt: v.prompt,
    answer: v.answer ?? null,
    solution: v.solution ?? null,
    difficulty: v.difficulty,
    marks: v.marks,
    question_type: v.questionType,
    calculator: v.calculator ?? null,
    year: v.year ?? null,
    paper: v.paper ?? null,
    source: v.source ?? null,
    license: v.license ?? null,
    status: v.status,
  };
}

export async function createQuestion(input: QuestionFormValues) {
  await requireAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the form and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .insert(toRow(parsed.data))
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/questions");
  return { ok: true, id: data.id };
}

export async function updateQuestion(id: string, input: QuestionFormValues) {
  await requireAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the form and try again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update(toRow(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/questions");
  revalidatePath(`/questions/${id}`);
  return { ok: true, id };
}

// ---------------------------------------------------------------
// Syllabus tree — themes, topics and subtopics are edited here so no
// code change is ever needed to restructure a subject.
// ---------------------------------------------------------------

const themeSchema = z.object({
  subjectId: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().nullable().optional(),
  levelCode: z.enum(["SL", "HL"]).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999),
});

const topicSchema = themeSchema.extend({
  themeId: z.string().uuid().nullable().optional(),
});

const subtopicSchema = z.object({
  topicId: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  sortOrder: z.number().int().min(0).max(999),
});

export type ThemeFormValues = z.infer<typeof themeSchema>;
export type TopicFormValues = z.infer<typeof topicSchema>;
export type SubtopicFormValues = z.infer<typeof subtopicSchema>;

function revalidateSyllabus() {
  revalidatePath("/admin/syllabus");
  revalidatePath("/subjects", "layout");
}

export async function saveTheme(id: string | null, input: ThemeFormValues) {
  await requireAdmin();
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the theme details." };
  const v = parsed.data;
  const row = {
    subject_id: v.subjectId,
    slug: v.slug,
    name: v.name,
    description: v.description ?? null,
    level_code: v.levelCode ?? null,
    sort_order: v.sortOrder,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("themes").update(row).eq("id", id)
    : await supabase.from("themes").insert(row);
  if (error) return { error: error.message };
  revalidateSyllabus();
  return { ok: true };
}

export async function saveTopic(id: string | null, input: TopicFormValues) {
  await requireAdmin();
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the topic details." };
  const v = parsed.data;
  const row = {
    subject_id: v.subjectId,
    theme_id: v.themeId ?? null,
    slug: v.slug,
    name: v.name,
    description: v.description ?? null,
    level_code: v.levelCode ?? null,
    sort_order: v.sortOrder,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("topics").update(row).eq("id", id)
    : await supabase.from("topics").insert(row);
  if (error) return { error: error.message };
  revalidateSyllabus();
  return { ok: true };
}

export async function saveSubtopic(
  id: string | null,
  input: SubtopicFormValues,
) {
  await requireAdmin();
  const parsed = subtopicSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the subtopic details." };
  const v = parsed.data;
  const row = {
    topic_id: v.topicId,
    slug: v.slug,
    name: v.name,
    sort_order: v.sortOrder,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("subtopics").update(row).eq("id", id)
    : await supabase.from("subtopics").insert(row);
  if (error) return { error: error.message };
  revalidateSyllabus();
  return { ok: true };
}

export async function setSyllabusStatus(
  kind: "themes" | "topics" | "subtopics",
  id: string,
  status: ContentStatus,
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from(kind).update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidateSyllabus();
  return { ok: true };
}

export async function moveSyllabusNode(
  kind: "themes" | "topics" | "subtopics",
  id: string,
  sortOrder: number,
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from(kind)
    .update({ sort_order: sortOrder })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateSyllabus();
  return { ok: true };
}

/** Moves every question from one topic into another, then archives the source. */
export async function mergeTopics(sourceId: string, targetId: string) {
  await requireAdmin();
  if (sourceId === targetId) return { error: "Pick two different topics." };

  const supabase = await createClient();
  const { error: moveError } = await supabase
    .from("questions")
    .update({ topic_id: targetId, subtopic_id: null })
    .eq("topic_id", sourceId);
  if (moveError) return { error: moveError.message };

  const { error } = await supabase
    .from("topics")
    .update({ status: "archived" })
    .eq("id", sourceId);
  if (error) return { error: error.message };
  revalidateSyllabus();
  return { ok: true };
}

export async function setQuestionStatus(id: string, status: ContentStatus) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/questions");
  return { ok: true };
}
