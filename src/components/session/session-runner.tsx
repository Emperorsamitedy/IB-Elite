"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Clock,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  ArrowRight,
  Trophy,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  QuestionContent,
  type QuestionForViewer,
} from "@/components/question/question-content";
import { TutorPanel } from "@/components/question/tutor-panel";
import { CONFIDENCE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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

type Outcome = { questionId: string; confidence: ConfidenceRating };

export function SessionRunner({
  sessionId,
  questions,
  startIndex,
  timeLimitSeconds,
}: {
  sessionId: string;
  questions: SessionQuestion[];
  startIndex: number;
  timeLimitSeconds: number | null;
}) {
  const [index, setIndex] = React.useState(
    Math.min(startIndex, questions.length - 1),
  );
  const [outcomes, setOutcomes] = React.useState<Outcome[]>([]);
  const [bookmarks, setBookmarks] = React.useState<Record<string, boolean>>(
    Object.fromEntries(questions.map((q) => [q.id, q.bookmarked])),
  );
  const [tutorOpen, setTutorOpen] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [remaining, setRemaining] = React.useState(timeLimitSeconds ?? 0);
  const questionStart = React.useRef(Date.now());

  const current = questions[index];
  const answered = outcomes.some((o) => o.questionId === current?.id);

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

    if (index < questions.length - 1) {
      const next = index + 1;
      setIndex(next);
      void setSessionProgress(sessionId, next);
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
        timeLimitSeconds={timeLimitSeconds}
        remaining={remaining}
      />
    );
  }

  if (!current) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      {/* header */}
      <div className="mb-5 flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/app" aria-label="Exit session">
            <X className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <Progress value={((index + 1) / questions.length) * 100} />
        </div>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {index + 1}/{questions.length}
        </span>
        {timeLimitSeconds !== null && (
          <Badge variant={remaining < 60 ? "danger" : "default"}>
            <Clock className="h-3.5 w-3.5" />
            {mins}:{secs.toString().padStart(2, "0")}
          </Badge>
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
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {current.topics?.name}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onBookmark}
                  aria-label="Bookmark"
                >
                  {bookmarks[current.id] ? (
                    <BookmarkCheck className="h-4 w-4 text-accent" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTutorOpen(true)}
                >
                  <Sparkles className="h-4 w-4 text-accent" /> Tutor
                </Button>
              </div>
            </div>
            <QuestionContent question={current} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* confidence bar */}
      <div className="sticky bottom-0 mt-6 border-t border-border bg-background/95 py-4 backdrop-blur">
        <p className="mb-2.5 text-center text-xs text-muted-foreground">
          How did you find this question?
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => rate(opt.value)}
              disabled={saving}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50",
                answered &&
                  outcomes.find((o) => o.questionId === current.id)
                    ?.confidence === opt.value
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:bg-surface-2",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Sheet open={tutorOpen} onOpenChange={setTutorOpen}>
        <SheetContent className="w-full max-w-md p-0">
          <TutorPanel questionId={current.id} />
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Trophy className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Session complete
        </h1>
        <p className="mt-1 text-muted-foreground">
          You answered {correct} of {total} correctly.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
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

      <div className="mt-6 flex flex-col gap-2">
        {questions.map((q, i) => {
          const o = outcomes.find((x) => x.questionId === q.id);
          const correctAns = o && o.confidence !== "wrong";
          return (
            <Link
              key={q.id}
              href={`/questions/${q.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm transition-colors hover:bg-surface-2"
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  o
                    ? correctAns
                      ? "bg-success/15 text-success"
                      : "bg-danger/15 text-danger"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className="line-clamp-1 flex-1">{q.prompt}</span>
              {o && (
                <Badge
                  variant={correctAns ? "success" : "danger"}
                  className="capitalize"
                >
                  {o.confidence}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>

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
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
