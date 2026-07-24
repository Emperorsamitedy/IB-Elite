import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { AdminQuestionActions } from "@/components/admin/admin-question-actions";
import type { ContentStatus } from "@/lib/types";

export const metadata = { title: "Manage questions" };

const STATUS_VARIANT: Record<
  ContentStatus,
  "success" | "warning" | "outline"
> = {
  published: "success",
  draft: "warning",
  archived: "outline",
};

const STATUSES: (ContentStatus | "all")[] = [
  "all",
  "published",
  "draft",
  "archived",
];

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (sp.status ?? "all") as ContentStatus | "all";
  const supabase = await createClient();

  let query = supabase
    .from("questions")
    .select("id, title, prompt, difficulty, status, topics(name, subjects(name))")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);

  const { data: questions } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
          <p className="mt-1 text-muted-foreground">
            {questions?.length ?? 0} question
            {questions?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/questions/new">
            <Plus className="h-4 w-4" /> New question
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "secondary" : "ghost"}
            size="sm"
            asChild
            className="capitalize"
          >
            <Link href={s === "all" ? "/admin/questions" : `/admin/questions?status=${s}`}>
              {s}
            </Link>
          </Button>
        ))}
      </div>

      {questions && questions.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {questions.map((q) => {
            const topic = q.topics as {
              name: string;
              subjects: { name: string } | null;
            } | null;
            return (
              <Card key={q.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">
                      {q.title || q.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {topic?.subjects?.name} · {topic?.name}
                    </p>
                  </div>
                  <Badge
                    variant={STATUS_VARIANT[q.status]}
                    className="capitalize"
                  >
                    {q.status}
                  </Badge>
                  <AdminQuestionActions id={q.id} status={q.status} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No questions"
          description="Create your first question to get started."
          action={
            <Button asChild>
              <Link href="/admin/questions/new">New question</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
