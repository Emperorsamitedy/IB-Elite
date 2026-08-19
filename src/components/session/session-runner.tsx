"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Bookmark,
  BookmarkCheck,
  MessageSquareText,
  ScanLine,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  QuestionContent,
  type QuestionForViewer,
} from "@/components/question/question-content";
import { TutorPanel } from "@/components/question/tutor-panel";
import { ScanMarker } from "@/components/scans/scan-marker";
import { ExamNavPanel } from "@/components/session/exam-nav-panel";
import { CONFIDENCE_OPTIONS } from "@/lib/constants";
import { cn, gradeFromAccuracy } from "@/lib/utils";
import { toast } from "sonner";
import {
  rateSessionQuestion,
  setSessionProgress,
  completeSession,
} from "@/lib/actions/session";
import { toggleBookmark } from "@/lib/actions/library";
import type { ConfidenceRating } from "@/lib/types";

export type SessionQuestion = QuestionForViewer & {
  bookmarked: boolean;
};

export type Outcome = { questionId: string; confidence: ConfidenceRating };

export function SessionRunner({
  sessionId,
  questions,
  startIndex,
  timeLimitSeconds,
  initialOutcomes,
  completed,
}: {
  sessionId: string;
  questions: SessionQuestion[];
  startIndex: number;
  timeLimitSeconds: number | null;
  initialOutcomes: Outcome[];
  completed: boolean;
}) {
  const [index, setIndex] = React.useState(
    Math.min(startIndex, questions.length - 1),
  );
  const [outcomes, setOutcomes] = React.useState<Outcome[]>(initialOutcomes);
  const [bookmarks, setBookmarks] = React.useState<Record<string, boolean>>(
    Object.fromEntries(questions.map((q) => [q.id, q.bookmarked])),
  );
  const [tutorOpen, setTutorOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [finished, setFinished] = React.useState(completed);
  const [saving, setSaving] = React.useState(false);
  const [remaining, setRemaining] = React.useState(timeLimitSeconds ?? 0);
  const questionStart = React.useRef(Date.now());

  const current = questions[index];
  const answered = outcomes.some((o) => o.questionId === current?.id);

  const outcomeByIndex = React.useMemo(() => {
    const map: Record<number, ConfidenceRating> = {};
    questions.forEach((q, i) => {
      const o = outcomes.find((x) => x.questionId === q.id);
      if (o) map[i] = o.confidence;
    });
    return map;
  }, [questions, outcomes]);

  const goTo = React.useCallback(
    (next: number) => {
      if (next === index || next < 0 || next >= questions.length) return;
      setIndex(next);
      void setSessionProgress(sessionId, next);
    },
    [index, questions.length, sessionId],
  );

  const finish = React.useCallback(async () => {
    setSaving(true);
    await completeSession(sessionId);
    setFinished(true);
    setSaving(false);
  }, [sessionId]);

  // Timer
  React.useEffect(() => {
    if (!timeLimitSeconds || finished) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          toast.info("Time's up!");
          void finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLimitSeconds, finished, finish]);

  React.useEffect(() => {
    questionStart.current = Date.now();
  }, [index]);

  const rate = async (confidence: ConfidenceRating) => {
    if (!current || saving) return;
    const timeSpent = Math.round((Date.now() - questionStart.current) / 1000);
    setOutcomes((o) => [
      ...o.filter((x) => x.questionId !== current.id),
      { questionId: current.id, confidence },
    ]);
    void rateSessionQuestion({
      sessionId,
      questionId: current.id,
      confidence,
      timeSpent,
    });

    // Jumping around the paper means "next" is the next unmarked question,
    // not simply index + 1.
    const marked = new Set(
      outcomes.map((o) => o.questionId).concat(current.id),
    );
    const next = questions.findIndex((q, i) => i > index && !marked.has(q.id));
    const wrapped =
      next >= 0 ? next : questions.findIndex((q) => !marked.has(q.id));

    if (wrapped >= 0) {
      setIndex(wrapped);
      void setSessionProgress(sessionId, wrapped);
    } else {
      await finish();
    }
  };

  const onBookmark = async () => {
    if (!current) return;
    setBookmarks((b) => ({ ...b, [current.id]: !b[current.id] }));
    const res = await toggleBookmark(current.id);
    setBookmarks((b) => ({ ...b, [current.id]: res.bookmarked }));
  };

  if (finished) {
    return (
      <SessionSummary
        questions={questions}
        outcomes={outcomes}
        timeLimitSeconds={completed ? null : timeLimitSeconds}
        remaining={remaining}
      />
    );
  }

  if (!current) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-[calc(100dvh-8rem)]">
        {/* header — notch tracker + mono apparatus */}
        <div className="mb-5 flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/app" aria-label="Exit session">
              <X className="h-4 w-4" />
            </Link>
          </Button>
          <ol
            className="flex flex-1 gap-1"
            aria-label={`Question ${index + 1} of ${questions.length}`}
          >
            {questions.map((q, i) => (
              <li
                key={q.id}
                className={cn(
                  "h-1.5 flex-1 rounded-[1px]",
                  i < index
                    ? "bg-ink dark:bg-foreground"
                    : i === index
                      ? "bg-accent"
                      : "bg-border",
                )}
              />
            ))}
          </ol>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {index + 1}/{questions.length}
          </span>
          {timeLimitSeconds !== null && (
            <span
              className={cn(
                "font-mono text-sm tabular-nums",
                remaining < 60 ? "text-accent" : "text-muted-foreground",
              )}
            >
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          )}
        </div>

        {/* question */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-border bg-ink-2 px-4 py-2 text-ink-foreground/80">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                  {current.topics?.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onBookmark}
                    aria-label="Bookmark"
                    aria-pressed={Boolean(bookmarks[current.id])}
                    className="rounded-md p-1.5 transition-colors hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {bookmarks[current.id] ? (
                      <BookmarkCheck className="h-4 w-4 text-accent" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setTutorOpen(true)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageSquareText className="h-4 w-4" /> Tutor
                  </button>
                  <button
                    onClick={() => setScanOpen(true)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ScanLine className="h-4 w-4" /> Scan work
                  </button>
                </div>
              </div>
              <div className="px-4 pt-4 sm:px-6">
                <QuestionContent question={current} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* confidence bar — marks the question, feeds the 7-gauge */}
        <div className="sticky bottom-0 mt-6 border-t border-border bg-background/95 py-4 backdrop-blur">
          <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Mark it
          </p>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border sm:grid-cols-4">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => rate(opt.value)}
                disabled={saving}
                className={cn(
                  "border-b border-r border-border px-3 py-3 font-mono text-xs uppercase tracking-[0.08em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50 sm:border-b-0",
                  answered &&
                    outcomes.find((o) => o.questionId === current.id)
                      ?.confidence === opt.value
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "bg-card hover:bg-surface-2",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ExamNavPanel
        count={questions.length}
        currentIndex={index}
        outcomes={outcomeByIndex}
        onSelect={goTo}
        className="shrink-0 lg:sticky lg:top-6 lg:w-72"
      />

      <Sheet open={tutorOpen} onOpenChange={setTutorOpen}>
        <SheetContent className="w-full max-w-md p-0">
          <TutorPanel questionId={current.id} />
        </SheetContent>
      </Sheet>

      <Sheet open={scanOpen} onOpenChange={setScanOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Scan your handwritten work
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Marked against this question&apos;s mark scheme
            </p>
          </div>
          <ScanMarker
            bare
            questions={[
              { id: current.id, label: current.title ?? current.prompt },
            ]}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SessionSummary({
  questions,
  outcomes,
  timeLimitSeconds,
  remaining,
}: {
  questions: SessionQuestion[];
  outcomes: Outcome[];
  timeLimitSeconds: number | null;
  remaining: number;
}) {
  const correct = outcomes.filter((o) => o.confidence !== "wrong").length;
  const total = questions.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const timeUsed =
    timeLimitSeconds !== null ? timeLimitSeconds - remaining : null;

  const grade = gradeFromAccuracy(total ? correct / total : 0);

  return (
    <div className="mx-auto max-w-2xl">
      {/* The session lands on the 7-gauge — the one orchestrated moment. */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Session complete · marked {correct}/{total}
        </p>
        <div className="mt-4 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-sm text-muted-foreground">
              This session scores
            </p>
            <p className="mt-1 font-mono text-6xl font-semibold leading-none text-accent">
              {grade}
              <span className="text-2xl text-muted-foreground">/7</span>
            </p>
          </div>
          <Gauge value={grade} size="lg" className="w-56" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <SummaryStat label="Accuracy" value={`${accuracy}%`} />
        <SummaryStat label="Correct" value={`${correct}/${total}`} />
        <SummaryStat
          label="Time"
          value={
            timeUsed !== null
              ? `${Math.floor(timeUsed / 60)}m ${timeUsed % 60}s`
              : "—"
          }
        />
      </div>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {questions.map((q, i) => {
          const o = outcomes.find((x) => x.questionId === q.id);
          const correctAns = o && o.confidence !== "wrong";
          return (
            <li key={q.id}>
              <Link
                href={`/questions/${q.id}`}
                className="flex items-center gap-3 py-3 text-sm transition-colors hover:text-accent"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] font-mono text-xs font-semibold",
                    o
                      ? correctAns
                        ? "bg-success/15 text-success"
                        : "bg-accent/15 text-accent"
                      : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="line-clamp-1 flex-1 font-serif text-[15px]">
                  {q.prompt}
                </span>
                {o && (
                  <Badge
                    variant={correctAns ? "success" : "danger"}
                    className="capitalize"
                  >
                    {o.confidence}
                  </Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/practice">
            <RotateCcw className="h-4 w-4" /> New session
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/app">
            Back to dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-mono text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
