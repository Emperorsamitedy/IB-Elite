import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FolderOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StartSessionButton } from "@/components/app/start-session-button";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("name")
    .eq("slug", subject)
    .maybeSingle();
  return { title: data?.name ?? "Subject" };
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: slug } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, slug, name, group_name, description, color")
    .eq("slug", slug)
    .maybeSingle();
  if (!subject) notFound();

  const [{ data: topics }, { data: attempts }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, slug, name, description, questions(count)")
      .eq("subject_id", subject.id)
      .order("sort_order"),
    supabase
      .from("question_attempts")
      .select("is_correct, questions!inner(topic_id, subject_id)")
      .eq("user_id", user.id)
      .eq("questions.subject_id", subject.id),
  ]);

  const stats = new Map<string, { total: number; correct: number }>();
  for (const a of attempts ?? []) {
    const q = a.questions as { topic_id: string } | null;
    if (!q) continue;
    const s = stats.get(q.topic_id) ?? { total: 0, correct: 0 };
    s.total += 1;
    if (a.is_correct) s.correct += 1;
    stats.set(q.topic_id, s);
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/subjects" className="hover:text-foreground">
          Subjects
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{subject.name}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {subject.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {subject.description ?? subject.group_name}
          </p>
        </div>
        <StartSessionButton input={{ subjectId: subject.id, count: 15 }}>
          Practise whole subject
        </StartSessionButton>
      </div>

      {topics && topics.length > 0 ? (
        <div className="grid gap-3">
          {topics.map((t) => {
            const count = (t.questions as { count: number }[])?.[0]?.count ?? 0;
            const st = stats.get(t.id);
            const acc = st && st.total ? st.correct / st.total : null;
            return (
              <Card key={t.id} interactive>
                <CardContent className="flex items-center gap-4 p-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${subject.color}1a`,
                      color: subject.color,
                    }}
                  >
                    <FolderOpen className="h-5 w-5" />
                  </span>
                  <Link
                    href={`/subjects/${subject.slug}/${t.slug}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} question{count === 1 ? "" : "s"}
                      {acc !== null
                        ? ` · ${Math.round(acc * 100)}% accuracy`
                        : ""}
                    </p>
                    {acc !== null && (
                      <Progress
                        value={acc * 100}
                        className="mt-2 max-w-xs"
                        indicatorClassName={
                          acc < 0.5
                            ? "bg-danger"
                            : acc < 0.75
                              ? "bg-warning"
                              : "bg-success"
                        }
                      />
                    )}
                  </Link>
                  <StartSessionButton
                    variant="secondary"
                    size="sm"
                    input={{ subjectId: subject.id, topicIds: [t.id], count: 10 }}
                  >
                    Practise
                  </StartSessionButton>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="No topics yet"
          description="Topics for this subject will appear here soon."
        />
      )}
    </div>
  );
}
