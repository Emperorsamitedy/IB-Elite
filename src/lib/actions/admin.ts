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
  answerType: z.enum(["free", "mcq", "numeric", "exact"]).default("free"),
  // Validated per type: the duel pool only draws structured questions.
  answerKey: z
    .union([
      z.object({
        options: z.array(z.string().min(1)).min(2).max(8),
        correct: z.number().int().min(0),
      }),
      z.object({ value: z.number(), tolerance: z.number().min(0) }),
      z.object({ accept: z.array(z.string().min(1)).min(1).max(20) }),
    ])
    .nullable()
    .optional(),
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
    answer_type: v.answerType,
    answer_key: v.answerKey ?? null,
    calculator: v.calculator ?? null,
    year: v.year ?? null,
    paper: v.paper ?? null,
    source: v.source ?? null,
    license: v.license ?? null,
    status: v.status,
  };
}

function answerKeyError(v: QuestionFormValues): string | null {
  if (v.answerType === "free") return null;
  const key = v.answerKey as Record<string, unknown> | null | undefined;
  if (!key) return "A structured answer needs its key filled in.";
  if (v.answerType === "mcq") {
    const options = key.options as string[] | undefined;
    const correct = key.correct as number | undefined;
    if (!options || correct === undefined || correct >= options.length) {
      return "MCQ needs options and a correct option among them.";
    }
  }
  if (v.answerType === "numeric" && typeof key.value !== "number") {
    return "Numeric answers need a target value.";
  }
  if (v.answerType === "exact" && !Array.isArray(key.accept)) {
    return "Exact answers need at least one accepted string.";
  }
  return null;
}

export async function createQuestion(input: QuestionFormValues) {
  await requireAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the form and try again." };
  const keyError = answerKeyError(parsed.data);
  if (keyError) return { error: keyError };

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
  const keyError = answerKeyError(parsed.data);
  if (keyError) return { error: keyError };

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
