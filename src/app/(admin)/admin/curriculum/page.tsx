import { createClient } from "@/lib/supabase/server";
import { CurriculumTree } from "@/components/admin/curriculum-tree";

export const metadata = { title: "Curriculum" };

export default async function AdminCurriculumPage() {
  const supabase = await createClient();

  const [subjects, themes, topics, subtopics] = await Promise.all([
    supabase.from("subjects").select("id, name, slug").order("sort_order"),
    supabase
      .from("themes")
      .select("id, name, slug, subject_id")
      .order("sort_order"),
    supabase
      .from("topics")
      .select("id, name, slug, subject_id, theme_id")
      .order("sort_order"),
    supabase
      .from("subtopics")
      .select("id, name, slug, topic_id")
      .order("sort_order"),
  ]);

  return (
    <CurriculumTree
      data={{
        subjects: subjects.data ?? [],
        themes: themes.data ?? [],
        topics: topics.data ?? [],
        subtopics: subtopics.data ?? [],
      }}
    />
  );
}
