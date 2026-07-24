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
