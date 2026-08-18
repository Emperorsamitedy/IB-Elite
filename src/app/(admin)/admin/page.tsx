import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gauge } from "@/components/ui/gauge";

export const metadata = { title: "Admin overview" };

type SubjectCoverage = {
  id: string;
  name: string;
  questions: number;
  topics: number;
};

/** Questions-per-topic completeness, expressed on the same 1–7 gauge scale. */
function coverageNotches(questions: number, topics: number) {
  if (topics === 0) return 0;
  const perTopic = questions / topics;
  return Math.max(0, Math.min(7, Math.round(perTopic)));
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [subjectsRes, questionsRes, recentRes, activeRes] = await Promise.all([
    supabase.from("subjects").select("id, name").order("sort_order"),
    supabase.from("questions").select("id, subject_id"),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarded", true),
  ]);

  const { data: topics } = await supabase.from("topics").select("id, subject_id");

  const subjects = subjectsRes.data ?? [];
  const questions = questionsRes.data ?? [];

  const coverage: SubjectCoverage[] = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    questions: questions.filter((q) => q.subject_id === s.id).length,
    topics: (topics ?? []).filter((t) => t.subject_id === s.id).length,
  }));

  const stats = [
    { label: "Total questions (all subjects)", value: questions.length },
    { label: "Questions added this week", value: recentRes.count ?? 0 },
    { label: "Active users", value: activeRes.count ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Admin dashboard
        </h1>
        <Button asChild>
          <Link href="/admin/questions">
            <Plus className="h-4 w-4" /> Manage questions
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight">
                {s.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {subjects.length} subject{subjects.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Content coverage by subject
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Questions per topic, on the 1–7 gauge.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {coverage.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border bg-surface-2 p-3"
              >
                <p className="truncate text-sm font-medium" title={c.name}>
                  {c.name}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {c.questions} q · {c.topics} topics
                </p>
                <Gauge
                  className="mt-3"
                  size="sm"
                  value={coverageNotches(c.questions, c.topics)}
                  showNumbers={false}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
