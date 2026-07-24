import Link from "next/link";
import { Sparkles, MessageSquare, AlertCircle, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement, FREE_LIMITS } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "AI Tutor" };

export default async function TutorPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const entitlement = await getEntitlement(user.id);

  const [{ data: conversations }, { data: mistakes }] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("id, title, created_at, questions(id, prompt)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("mistakes")
      .select("question_id, questions(prompt, topics(name))")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">AI Tutor</h1>
          <Badge variant={entitlement.isPro ? "accent" : "outline"}>
            {entitlement.isPro
              ? "Unlimited"
              : `${FREE_LIMITS.aiMessagesPerDay}/day free`}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          Get guided, step-by-step help on any question — hints that teach, not
          just answers.
        </p>
      </div>

      <Card className="border-accent/30 bg-gradient-to-br from-accent-soft/50 to-card">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">How the tutor works</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open any question and tap <strong>Tutor</strong>. Ask for a hint
              and the tutor guides you one step at a time. Start from a question
              you found tricky below.
            </p>
          </div>
          <Button asChild>
            <Link href="/questions">
              Browse questions <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {mistakes && mistakes.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-4 w-4 text-muted-foreground" /> Get help
            with your mistakes
          </h2>
          <div className="flex flex-col gap-2.5">
            {mistakes.map((m) => {
              const q = m.questions as {
                prompt: string;
                topics: { name: string } | null;
              } | null;
              if (!q) return null;
              return (
                <Link key={m.question_id} href={`/questions/${m.question_id}`}>
                  <Card interactive>
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="line-clamp-1 flex-1 text-sm">
                        {q.prompt}
                      </span>
                      {q.topics && (
                        <Badge variant="outline">{q.topics.name}</Badge>
                      )}
                      <Sparkles className="h-4 w-4 text-accent" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" /> Recent
          tutor sessions
        </h2>
        {conversations && conversations.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {conversations.map((c) => {
              const q = c.questions as { id: string; prompt: string } | null;
              return (
                <Link
                  key={c.id}
                  href={q ? `/questions/${q.id}` : "/questions"}
                >
                  <Card interactive>
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="line-clamp-1 flex-1 text-sm">
                        {q?.prompt ?? c.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(c.created_at)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No tutor sessions yet"
            description="Open a question and ask the tutor for a hint to get started."
          />
        )}
      </section>
    </div>
  );
}
