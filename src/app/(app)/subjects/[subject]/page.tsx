import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSubject, getSubjectTree } from "@/lib/syllabus";
import { SubjectTree } from "@/components/syllabus/subject-tree";
import { StartSessionButton } from "@/components/app/start-session-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const record = await getSubject(subject);
  return { title: record?.name ?? "Subject" };
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: slug } = await params;
  const user = await requireUser();

  const subject = await getSubject(slug);
  if (!subject) notFound();

  const tree = await getSubjectTree(subject, user.id);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <Link href="/subjects" className="hover:text-foreground">
          Subjects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{subject.name}</span>
      </nav>

      <header
        className="border-l-4 pl-4"
        style={{ borderLeftColor: subject.color }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {subject.group_name}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {subject.name}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {subject.description}
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {tree.themes.length} themes · {tree.totals.topics} topics ·{" "}
              {tree.totals.questions} questions · {tree.totals.attempted} attempted
            </p>
          </div>
          <StartSessionButton
            input={{ subjectId: subject.id, count: 15 }}
            disabled={tree.totals.questions === 0}
          >
            Practise whole subject
          </StartSessionButton>
        </div>
      </header>

      <SubjectTree tree={tree} subjectSlug={subject.slug} subjectId={subject.id} />
    </div>
  );
}
