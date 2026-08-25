import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  QuestionForm,
  type AdminSubject,
} from "@/components/admin/question-form";
import { ReviewerCard } from "@/components/admin/reviewer-card";
import type { QuestionFormValues } from "@/lib/actions/admin";

export const metadata = { title: "Edit question" };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: subjectsData }, { data: q }] = await Promise.all([
    supabase
      .from("subjects")
      .select(
      "id, name, levels(id, code, name), themes(id, name), topics(id, name, theme_id, subtopics(id, name))",
    )
      .order("sort_order"),
    supabase.from("questions").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!q) notFound();

  const subjects = (subjectsData ?? []) as AdminSubject[];
  const initial: Partial<QuestionFormValues> = {
    subjectId: q.subject_id,
    topicId: q.topic_id,
    levelId: q.level_id,
    subtopicId: q.subtopic_id,
    questionNumber: q.question_number,
    tags: q.tags,
    estimatedMinutes: q.estimated_minutes,
    title: q.title,
    prompt: q.prompt,
    answer: q.answer,
    solution: q.solution,
    difficulty: q.difficulty,
    marks: q.marks,
    questionType: q.question_type,
    calculator: q.calculator,
    year: q.year,
    paper: q.paper,
    source: q.source,
    license: q.license,
    status: q.status,
    answerType: (q.answer_type ?? "free") as QuestionFormValues["answerType"],
    answerKey: q.answer_key as QuestionFormValues["answerKey"],
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/admin/questions" className="hover:text-foreground">
          Questions
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Edit</span>
      </nav>
      <h1 className="text-2xl font-extrabold tracking-tight">Edit question</h1>
      <QuestionForm subjects={subjects} questionId={id} initial={initial} />
      <ReviewerCard
        questionId={id}
        review={{
          reviewer_name: q.reviewer_name,
          reviewer_credential: q.reviewer_credential,
          reviewed_at: q.reviewed_at,
        }}
      />
    </div>
  );
}
