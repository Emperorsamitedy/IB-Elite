"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Bookmark,
  BookmarkCheck,
  MessageSquareText,
  NotebookPen,
  AlertCircle,
  Check,
  PencilRuler,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  QuestionContent,
  type QuestionForViewer,
} from "@/components/question/question-content";
import { TutorPanel } from "@/components/question/tutor-panel";
import { useDeclareAssistantContext } from "@/components/assistant/assistant-provider";
import { ShowYourWork } from "@/components/whiteboard/show-your-work";
import { CONFIDENCE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  toggleBookmark,
  addMistake,
  saveNote,
  rateQuestion,
} from "@/lib/actions/library";
import type { ConfidenceRating } from "@/lib/types";

const toolClass =
  "flex items-center rounded-md p-1.5 transition-colors hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function QuestionViewer({
  question,
  initialBookmarked,
  initialNote,
}: {
  question: QuestionForViewer;
  initialBookmarked: boolean;
  initialNote: string;
}) {
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [showNotes, setShowNotes] = React.useState(Boolean(initialNote));
  const [note, setNote] = React.useState(initialNote);
  const [tutorOpen, setTutorOpen] = React.useState(false);
  const [workOpen, setWorkOpen] = React.useState(false);
  const [rated, setRated] = React.useState<ConfidenceRating | null>(null);
  const start = React.useRef(Date.now());

  useDeclareAssistantContext({
    page: "Question",
    topic: question.topics?.name ?? null,
    questionId: question.id,
    detail: question.title ?? null,
  });

  const onBookmark = async () => {
    setBookmarked((b) => !b);
    const res = await toggleBookmark(question.id);
    setBookmarked(res.bookmarked);
    toast.success(res.bookmarked ? "Bookmarked" : "Removed bookmark");
  };

  const onMistake = async () => {
    await addMistake(question.id);
    toast.success("Added to your mistake notebook");
  };

  const onSaveNote = async () => {
    await saveNote(question.id, note);
    toast.success("Note saved");
  };

  const onRate = async (c: ConfidenceRating) => {
    setRated(c);
    const timeSpent = Math.round((Date.now() - start.current) / 1000);
    await rateQuestion(question.id, c, timeSpent);
    toast.success("Progress recorded");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-ink-2 px-4 py-2 text-ink-foreground/80">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
            {question.topics?.name}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onBookmark}
              aria-label="Bookmark"
              aria-pressed={bookmarked}
              className={toolClass}
            >
              {bookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-accent" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setShowNotes((s) => !s)}
              aria-label="Notes"
              aria-pressed={showNotes}
              className={toolClass}
            >
              <NotebookPen className={cn("h-4 w-4", note && "text-accent")} />
            </button>
            <button onClick={onMistake} className={cn(toolClass, "gap-1.5")}>
              <AlertCircle className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                Mark difficult
              </span>
            </button>
            <button
              onClick={() => setTutorOpen(true)}
              className={cn(toolClass, "gap-1.5")}
            >
              <MessageSquareText className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                Tutor
              </span>
            </button>
            <button
              onClick={() => setWorkOpen(true)}
              className={cn(toolClass, "gap-1.5")}
            >
              <PencilRuler className="h-4 w-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                Show your work
              </span>
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 sm:px-6">
          <QuestionContent question={question} />
        </div>

        {showNotes && (
          <div className="border-t border-border px-4 py-4 sm:px-6">
            <label
              htmlFor="question-note"
              className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              Your notes
            </label>
            <Textarea
              id="question-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={onSaveNote}
              placeholder="Jot down what tripped you up, or a method to remember…"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* rating — snaps onto the 7-gauge */}
      <div className="mt-5">
        <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          How confident are you?
        </p>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border sm:grid-cols-4">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              className={cn(
                "flex items-center justify-center gap-1.5 border-b border-r border-border px-3 py-3 font-mono text-xs uppercase tracking-[0.08em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:border-b-0",
                rated === opt.value
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "bg-card hover:bg-surface-2",
              )}
            >
              {rated === opt.value && <Check className="h-3.5 w-3.5" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Sheet open={tutorOpen} onOpenChange={setTutorOpen}>
        <SheetContent className="w-full max-w-md p-0">
          <TutorPanel questionId={question.id} />
        </SheetContent>
      </Sheet>

      <Sheet open={workOpen} onOpenChange={setWorkOpen}>
        <SheetContent className="w-full max-w-3xl p-0">
          {workOpen && <ShowYourWork questionId={question.id} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
