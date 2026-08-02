import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Bookmark, AlertCircle, MessageSquareText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSubject, getTopicDetail, getTopicName } from "@/lib/syllabus";
import { StartSessionButton } from "@/components/app/start-session-button";
import { TopicQuestionBrowser } from "@/components/syllabus/topic-question-browser";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject, topic } = await params;
  const record = await getSubject(subject);
  const name = record ? await getTopicName(record.id, topic) : null;
  return { title: name ?? "Topic" };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  const user = await requireUser();

  const subject = await getSubject(subjectSlug);
  if (!subject) notFound();

  const detail = await getTopicDetail(subject.id, topicSlug, user.id);
  if (!detail) notFound();

  const { topic, theme, stats } = detail;
  const sessionSize = Math.min(Math.max(stats.questionCount, 1), 10);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <Link href="/subjects" className="hover:text-foreground">
          Subjects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/subjects/${subject.slug}`} className="hover:text-foreground">
          {subject.name}
        </Link>
        {theme && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span>{theme.name}</span>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{topic.name}</span>
      </nav>

      <header
        className="border-l-4 pl-4"
        style={{ borderLeftColor: subject.color }}
      >
        <div className="flex items-start gap-4">
          <ProgressRing value={stats.completion} size={56} stroke={5} />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {topic.name}
              {topic.levelCode && (
                <span className="ml-2 align-middle font-mono text-xs uppercase tracking-[0.1em] text-accent">
                  {topic.levelCode}
                </span>
              )}
            </h1>
            {topic.description && (
              <p className="mt-1 max-w-2xl text-muted-foreground">
                {topic.description}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          <Metric label="Questions" value={String(stats.questionCount)} />
          <Metric
            label="Progress"
            value={`${Math.round(stats.completion * 100)}%`}
          />
          <Metric
            label="Accuracy"
            value={stats.accuracy === null ? "—" : `${Math.round(stats.accuracy * 100)}%`}
          />
          <Metric
            label="Study time"
            value={`~${formatDuration(stats.estimatedMinutes)}`}
          />
          <Metric
            label="Recommended"
            value={`${sessionSize} questions`}
          />
        </dl>
      </header>

      <div className="flex flex-wrap gap-2">
        <StartSessionButton
          input={{
            subjectId: subject.id,
            topicIds: [topic.id],
            count: sessionSize,
          }}
          disabled={stats.questionCount === 0}
        >
          Start practice
        </StartSessionButton>
        <StartSessionButton
          variant="secondary"
          input={{
            subjectId: subject.id,
            topicIds: [topic.id],
            count: sessionSize,
            includeMistakes: true,
          }}
          disabled={stats.questionCount === 0}
        >
          Practise weak areas
        </StartSessionButton>
        <StartSessionButton
          variant="secondary"
          input={{
            subjectId: subject.id,
            topicIds: [topic.id],
            count: 5,
          }}
          disabled={stats.questionCount === 0}
        >
          Random questions
        </StartSessionButton>
        <Button asChild variant="ghost">
          <Link href="/bookmarks">
            <Bookmark className="h-4 w-4" /> Bookmarks
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/mistakes">
            <AlertCircle className="h-4 w-4" /> Mistakes
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/tutor">
            <MessageSquareText className="h-4 w-4" /> AI tutor
          </Link>
        </Button>
      </div>

      {stats.weakSubtopic && (
        <p className="border-l-2 border-accent bg-accent-soft/50 px-4 py-3 text-sm">
          Weakest subtopic so far:{" "}
          <span className="font-semibold">{stats.weakSubtopic}</span>. Start there.
        </p>
      )}

      <TopicQuestionBrowser detail={detail} topicName={topic.name} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
