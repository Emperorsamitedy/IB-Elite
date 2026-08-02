import Link from "next/link";
import { FileQuestion, Library, FolderTree, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ContentStatus } from "@/lib/types";

export const metadata = { title: "Admin" };

type AdminClient = Awaited<ReturnType<typeof createClient>>;

async function questionCount(supabase: AdminClient, status: ContentStatus) {
  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

async function tableCount(supabase: AdminClient, table: "subjects" | "topics") {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [published, drafts, archived, subjects, topics] = await Promise.all([
    questionCount(supabase, "published"),
    questionCount(supabase, "draft"),
    questionCount(supabase, "archived"),
    tableCount(supabase, "subjects"),
    tableCount(supabase, "topics"),
  ]);

  const stats = [
    { label: "Published", value: published, icon: FileQuestion },
    { label: "Drafts", value: drafts, icon: FileQuestion },
    { label: "Archived", value: archived, icon: FileQuestion },
    { label: "Subjects", value: subjects, icon: Library },
    { label: "Topics", value: topics, icon: FolderTree },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Content admin
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage the question bank and curriculum.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/questions/new">
            <Plus className="h-4 w-4" /> New question
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <p className="mt-3 text-2xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card interactive>
        <Link href="/admin/questions">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium">Manage questions</p>
              <p className="text-sm text-muted-foreground">
                Create, edit, publish and archive questions.
              </p>
            </div>
            <FileQuestion className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Link>
      </Card>

      <Card interactive>
        <Link href="/admin/syllabus">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium">Manage syllabus</p>
              <p className="text-sm text-muted-foreground">
                Themes, topics and subtopics — add, rename, reorder, merge or
                archive. Navigation follows this tree.
              </p>
            </div>
            <FolderTree className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}
