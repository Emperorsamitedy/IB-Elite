import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Sparkles,
  AlertCircle,
  TrendingDown,
  CalendarClock,
  BookOpen,
  Target,
  Compass,
} from "lucide-react";
import { requireUser, getProfile } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { greeting, daysUntil, pluralize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/misc";
import { StartSessionButton } from "@/components/app/start-session-button";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const data = await getDashboardData(user.id);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-1 text-muted-foreground">
          {data.isNewUser
            ? "Let's set up your first revision session."
            : "Here's your revision command center."}
        </p>
      </div>

      {/* Recommendation / empty state */}
      {data.recommendation ? (
        <Card className="overflow-hidden border-accent/30 bg-gradient-to-br from-accent-soft/60 to-card">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Your next best session
              </span>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {data.recommendation.topicName ?? data.recommendation.subjectName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.recommendation.subjectName} ·{" "}
                {pluralize(data.recommendation.count, "question")} ·{" "}
                <Clock className="mb-0.5 inline h-3.5 w-3.5" /> ~
                {data.recommendation.estMinutes} min
              </p>
              <p className="mt-2 text-sm text-foreground/80">
                {data.recommendation.reason}
              </p>
            </div>
            <StartSessionButton
              size="lg"
              input={{
                subjectId: data.recommendation.subjectId || undefined,
                topicIds: data.recommendation.topicId
                  ? [data.recommendation.topicId]
                  : undefined,
                count: data.recommendation.count,
              }}
            >
              Start session <ArrowRight className="h-4 w-4" />
            </StartSessionButton>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Compass}
              title="Let's create your first revision session"
              description="Choose a subject, take a quick diagnostic, or explore topics to get started."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/subjects">
                      <BookOpen className="h-4 w-4" /> Choose a subject
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/practice">
                      <Target className="h-4 w-4" /> Build a session
                    </Link>
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* stats strip */}
      {!data.isNewUser && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Questions done"
            value={String(data.stats.totalAttempts)}
          />
          <StatTile
            label="Accuracy"
            value={`${Math.round(data.stats.accuracy * 100)}%`}
          />
          <StatTile
            label="Open mistakes"
            value={String(data.stats.unresolvedMistakes)}
          />
          <StatTile label="Subjects" value={String(data.subjects.length)} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Exam countdowns */}
        <Section
          title="Exam countdown"
          icon={CalendarClock}
          action={
            <Link
              href="/settings"
              className="text-xs font-medium text-accent hover:underline"
            >
              Manage
            </Link>
          }
        >
          {data.exams.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {data.exams.slice(0, 4).map((e) => {
                const days = daysUntil(e.exam_date);
                const subj = e.subjects as { name: string; slug: string } | null;
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {subj?.name ?? "Exam"}
                    </span>
                    <Badge variant={days <= 14 ? "warning" : "default"}>
                      {days} {days === 1 ? "day" : "days"} left
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <MutedEmpty text="No exam dates yet. Add them in settings for countdowns." />
          )}
        </Section>

        {/* Weak topics */}
        <Section title="Needs attention" icon={TrendingDown}>
          {data.weakTopics.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.weakTopics.map((t) => (
                <Link
                  key={t.topicId}
                  href={`/subjects/${t.subjectSlug}/${t.topicSlug}`}
                  className="group flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium group-hover:text-accent">
                      {t.topicName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(t.accuracy * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={t.accuracy * 100}
                    indicatorClassName={
                      t.accuracy < 0.5 ? "bg-danger" : "bg-warning"
                    }
                  />
                </Link>
              ))}
            </div>
          ) : (
            <MutedEmpty text="Practise a few questions and weak topics will surface here." />
          )}
        </Section>
      </div>

      {/* Continue studying */}
      {data.activeSessions.length > 0 && (
        <Section title="Continue studying" icon={Clock}>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.activeSessions.map((s) => {
              const subj = s.subjects as { name: string; slug: string } | null;
              const pct = s.total_questions
                ? Math.round((s.current_index / s.total_questions) * 100)
                : 0;
              return (
                <Link key={s.id} href={`/session/${s.id}`}>
                  <Card interactive className="h-full">
                    <CardContent className="flex flex-col gap-3 p-4">
                      <span className="text-sm font-medium">
                        {subj?.name ?? "Practice session"}
                      </span>
                      <Progress value={pct} />
                      <span className="text-xs text-muted-foreground">
                        {s.current_index}/{s.total_questions} · resume
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* Recent mistakes */}
      <Section
        title="Recent mistakes"
        icon={AlertCircle}
        action={
          <Link
            href="/mistakes"
            className="text-xs font-medium text-accent hover:underline"
          >
            Open notebook
          </Link>
        }
      >
        {data.recentMistakes.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {data.recentMistakes.map((m) => {
              const q = m.questions as {
                id: string;
                prompt: string;
                topics: { name: string } | null;
              } | null;
              if (!q) return null;
              return (
                <Link
                  key={m.question_id}
                  href={`/questions/${q.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <span className="line-clamp-1 flex-1 text-sm">
                    {q.prompt}
                  </span>
                  {q.topics && (
                    <Badge variant="outline" className="shrink-0">
                      {q.topics.name}
                    </Badge>
                  )}
                </Link>
              );
            })}
            <div className="pt-1">
              <StartSessionButton
                variant="secondary"
                input={{ includeMistakes: true, count: 10, mode: "mistakes" }}
              >
                Practise my mistakes
              </StartSessionButton>
            </div>
          </div>
        ) : (
          <MutedEmpty text="No mistakes logged yet. They'll appear here as you practise." />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function MutedEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
