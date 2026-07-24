"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Bookmark,
  BookmarkCheck,
  Sparkles,
  NotebookPen,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  QuestionContent,
  type QuestionForViewer,
} from "@/components/question/question-content";
import { TutorPanel } from "@/components/question/tutor-panel";
import { CONFIDENCE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  toggleBookmark,
  addMistake,
  saveNote,
  rateQuestion,
} from "@/lib/actions/library";
import type { ConfidenceRating } from "@/lib/types";

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
  const [rated, setRated] = React.useState<ConfidenceRating | null>(null);
  const start = React.useRef(Date.now());

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
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {question.topics?.name}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onBookmark}
                aria-label="Bookmark"
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-accent" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowNotes((s) => !s)}
                aria-label="Notes"
              >
                <NotebookPen
                  className={cn("h-4 w-4", note && "text-accent")}
                />
              </Button>
              <Button variant="ghost" size="sm" onClick={onMistake}>
                <AlertCircle className="h-4 w-4" /> Mark difficult
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTutorOpen(true)}>
                <Sparkles className="h-4 w-4 text-accent" /> Tutor
              </Button>
            </div>
          </div>

          <QuestionContent question={question} />

          {showNotes && (
            <div className="mt-5 border-t border-border pt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your notes
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={onSaveNote}
                placeholder="Jot down what tripped you up, or a method to remember…"
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* rating */}
      <div className="mt-5">
        <p className="mb-2.5 text-center text-xs text-muted-foreground">
          How confident are you with this question?
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all hover:-translate-y-0.5",
                rated === opt.value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border hover:bg-surface-2",
              )}
            >
              {rated === opt.value && <Check className="h-4 w-4" />}
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
    </div>
  );
}
