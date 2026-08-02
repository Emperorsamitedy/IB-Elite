import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  SyllabusEditor,
  type AdminSyllabusSubject,
  type AdminTopic,
} from "@/components/admin/syllabus-editor";

export const metadata = { title: "Syllabus" };

export default async function AdminSyllabusPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: subjects }, { data: themes }, { data: topics }] =
    await Promise.all([
      supabase.from("subjects").select("id, slug, name").order("sort_order"),
      supabase
        .from("themes")
        .select("id, subject_id, slug, name, level_code, sort_order, status")
        .order("sort_order"),
      supabase
        .from("topics")
        .select(
          "id, subject_id, theme_id, slug, name, level_code, sort_order, status, questions(count), subtopics(id, slug, name, sort_order, status)",
        )
        .order("sort_order"),
    ]);

  const topicNodes = new Map<string, AdminTopic>();
  for (const t of topics ?? []) {
    topicNodes.set(t.id, {
      id: t.id,
      slug: t.slug,
      name: t.name,
      levelCode: t.level_code,
      sortOrder: t.sort_order,
      status: t.status,
      questionCount: (t.questions as { count: number }[])?.[0]?.count ?? 0,
      subtopics: (t.subtopics ?? [])
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          sortOrder: s.sort_order,
          status: s.status,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }

  const tree: AdminSyllabusSubject[] = (subjects ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    themes: (themes ?? [])
      .filter((th) => th.subject_id === s.id)
      .map((th) => ({
        id: th.id,
        slug: th.slug,
        name: th.name,
        levelCode: th.level_code,
        sortOrder: th.sort_order,
        status: th.status,
        topics: (topics ?? [])
          .filter((t) => t.theme_id === th.id)
          .map((t) => topicNodes.get(t.id))
          .filter((t): t is AdminTopic => Boolean(t)),
      })),
    looseTopics: (topics ?? [])
      .filter((t) => t.subject_id === s.id && !t.theme_id)
      .map((t) => topicNodes.get(t.id))
      .filter((t): t is AdminTopic => Boolean(t)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">
          Admin
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Syllabus</span>
      </nav>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Syllabus</h1>
        <p className="mt-1 text-muted-foreground">
          Add, rename, reorder, merge or archive themes, topics and subtopics.
          Navigation is rendered from this tree, so no code change is needed.
        </p>
      </div>

      <SyllabusEditor subjects={tree} />
    </div>
  );
}
