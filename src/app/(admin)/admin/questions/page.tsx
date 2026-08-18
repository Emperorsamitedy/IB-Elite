import { createClient } from "@/lib/supabase/server";
import { QuestionBank } from "@/components/admin/question-bank";

export const metadata = { title: "Question bank" };

export default async function AdminQuestionsPage() {
  const supabase = await createClient();

  const [subjectsRes, topicsRes, questionsRes] = await Promise.all([
    supabase.from("subjects").select("id, name").order("sort_order"),
    supabase
      .from("topics")
      .select("id, name, subject_id, subtopics(id, name)")
      .order("sort_order"),
    supabase
      .from("questions")
      .select(
        "id, title, prompt, answer, solution, subject_id, topic_id, subtopic_id, command_term, difficulty, marks, question_type, status",
      )
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <QuestionBank
      subjects={subjectsRes.data ?? []}
      topics={topicsRes.data ?? []}
      questions={questionsRes.data ?? []}
    />
  );
}
