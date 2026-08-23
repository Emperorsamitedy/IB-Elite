import Link from "next/link";
import { MathText } from "@/components/ui/math-text";
import {
  ArrowRight,
  Clock,
  AlertCircle,
  TrendingDown,
  CalendarClock,
  BookOpen,
  Target,
  Compass,
} from "lucide-react";
import { requireUser, getProfile } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { greeting, daysUntil, pluralize, gradeFromAccuracy } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "@/components/ui/gauge";
import { CommandStamp } from "@/components/ui/stamp";
import { EmptyState } from "@/components/ui/misc";
import { StartSessionButton } from "@/components/app/start-session-button";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const data = await getDashboardData(user.id);
  const firstName = profile?.full_name?.split(" ")[0];
  const nextExam = data.exams[0];

  return (
    <div className="flex flex-col gap-8">
      {/* Header — masthead with mono apparatus */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1 text-muted-foreground">
            {data.isNewUser
              ? "Set up your first revision session."
              : "Pick up where you left off."}
          </p>
        </div>
        <dl className="flex gap-6 font-mono text-xs text-muted-foreground">
          <div>
            <dt className="uppercase tracking-[0.12em]">Done</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">
              {data.stats.totalAttempts}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.12em]">Accuracy</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">
              {Math.round(data.stats.accuracy * 100)}%
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.12em]">Open mistakes</dt>
            <dd className="mt-1 text-lg font-semibold text-accent">
              {data.stats.unresolvedMistakes}
            </dd>
          </div>
          {nextExam && (
            <div>
              <dt className="uppercase tracking-[0.12em]">Next exam</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {daysUntil(nextExam.exam_date)}d
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Next best session — the one bold panel on the page */}
      {data.recommendation ? (
        <div className="relative overflow-hidden rounded-xl bg-ink px-6 py-7 text-ink-foreground sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-ruled" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <CommandStamp term="Next" />
              <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
                {data.recommendation.topicName ?? data.recommendation.subjectName}
              </h2>
              <p className="mt-1.5 font-mono text-xs text-ink-foreground/70">
                {data.recommendation.subjectName} ·{" "}
                {pluralize(data.recommendation.count, "question")} · ~
                {data.recommendation.estMinutes} MIN
              </p>
              <p className="mt-3 max-w-lg text-sm text-ink-foreground/80">
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
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Compass}
              title="Create your first revision session"
              description="Choose a subject, or build a session by topic and difficulty."
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

      {/* The 7-gauge — where each subject stands */}
      {data.standings.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Your standing · the 7-gauge
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              from {data.stats.totalAttempts} marked
            </span>
          </div>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {data.standings.map((s) => (
              <Link
                key={s.subjectSlug}
                href={`/subjects/${s.subjectSlug}`}
                className="group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
              >
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold group-hover:text-accent">
                    {s.subjectName}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    now <b className="text-sm text-accent">{s.grade}</b>/7
                  </span>
                </div>
                <Gauge value={s.grade} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Exam countdowns */}
        <Section
          title="Exam countdown"
          icon={CalendarClock}
          action={
            <Link
              href="/settings"
              className="font-mono text-xs text-accent hover:underline"
            >
              Manage
            </Link>
          }
        >
          {data.exams.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {data.exams.slice(0, 4).map((e) => {
                const days = daysUntil(e.exam_date);
                const subj = e.subjects as { name: string; slug: string } | null;
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="text-sm font-medium">
                      {subj?.name ?? "Exam"}
                    </span>
                    <span
                      className={
                        "font-mono text-sm " +
                        (days <= 14 ? "text-accent" : "text-muted-foreground")
                      }
                    >
                      {days}d
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <MutedEmpty text="No exam dates yet. Add them in settings for countdowns." />
          )}
        </Section>

        {/* Weak topics — gauged, not bar-charted */}
        <Section title="Needs attention" icon={TrendingDown}>
          {data.weakTopics.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {data.weakTopics.map((t) => (
                <li key={t.topicId}>
                  <Link
                    href={`/subjects/${t.subjectSlug}/${t.topicSlug}`}
                    className="group flex items-center justify-between gap-6 py-3"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium group-hover:text-accent">
                        {t.topicName}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t.correct}/{t.attempts} correct
                      </span>
                    </div>
                    <Gauge
                      value={gradeFromAccuracy(t.accuracy)}
                      size="sm"
                      showNumbers={false}
                      className="w-24 shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
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
                      <span className="text-sm font-semibold">
                        {subj?.name ?? "Practice session"}
                      </span>
                      <Progress value={pct} />
                      <span className="font-mono text-xs text-muted-foreground">
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
            className="font-mono text-xs text-accent hover:underline"
          >
            Open notebook
          </Link>
        }
      >
        {data.recentMistakes.length > 0 ? (
          <>
            <ul className="divide-y divide-border border-y border-border">
              {data.recentMistakes.map((m) => {
                const q = m.questions as {
                  id: string;
                  prompt: string;
                  topics: { name: string } | null;
                } | null;
                if (!q) return null;
                return (
                  <li key={m.question_id}>
                    <Link
                      href={`/questions/${q.id}`}
                      className="flex items-center gap-4 py-3 transition-colors hover:text-accent"
                    >
                      <MathText
                        as="span"
                        className="line-clamp-1 flex-1 font-serif text-[15px]"
                      >
                        {q.prompt}
                      </MathText>
                      {q.topics && (
                        <Badge variant="outline" className="shrink-0">
                          {q.topics.name}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="pt-4">
              <StartSessionButton
                variant="outline"
                input={{ includeMistakes: true, count: 10, mode: "mistakes" }}
              >
                Redo my mistakes
              </StartSessionButton>
            </div>
          </>
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
        <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MutedEmpty({ text }: { text: string }) {
  return (
    <div className="border-y border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
