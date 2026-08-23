"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandStamp, commandTermFor } from "@/components/ui/stamp";
import { Gauge } from "@/components/ui/gauge";
import { MathText } from "@/components/ui/math-text";
import { QuestionFigures } from "@/components/question/question-figures";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";

export type QuestionForViewer = {
  id: string;
  title: string | null;
  prompt: string;
  answer: string | null;
  solution: string | null;
  difficulty: Difficulty;
  marks: number;
  question_type: string;
  calculator: boolean | null;
  year: number | null;
  paper: string | null;
  source: string | null;
  license: string | null;
  reviewer_name?: string | null;
  reviewer_credential?: string | null;
  reviewed_at?: string | null;
  topics?: { name: string } | null;
};

/** Difficulty sits on the same 1–7 instrument as everything else. */
const DIFF_GRADE: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 6 };

export function QuestionContent({
  question,
  revealDefault = false,
}: {
  question: QuestionForViewer;
  revealDefault?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(revealDefault);
  const hasSolution = Boolean(question.answer || question.solution);
  const term = commandTermFor(question.title ?? question.prompt);

  React.useEffect(() => setRevealed(revealDefault), [question.id, revealDefault]);

  const meta = [
    question.paper,
    question.year ? String(question.year) : null,
    question.question_type.replace(/-/g, " "),
    question.calculator === null
      ? null
      : question.calculator
        ? "calculator"
        : "no calculator",
  ].filter(Boolean) as string[];

  return (
    <div>
      {/* Paper header — mono apparatus, like the top of a real exam paper */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>{meta.join(" · ")}</span>
        <span className="flex items-center gap-3">
          <span className="capitalize">{question.difficulty}</span>
          <Gauge
            value={DIFF_GRADE[question.difficulty]}
            size="sm"
            showNumbers={false}
            className="w-16"
          />
        </span>
      </div>

      {/* Body — margin rail + reading column */}
      <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[64px_1fr]">
        <div className="flex flex-col items-center gap-3 border-r border-border py-5 font-mono text-xs">
          <span className="font-semibold text-accent">[{question.marks}]</span>
        </div>

        <div className="py-5 pl-4 sm:pl-6">
          <CommandStamp term={term} arrow={false} />
          {question.title && (
            <h2 className="mt-3 text-lg font-bold tracking-tight">
              {question.title}
            </h2>
          )}
          <MathText className="mt-3 font-serif text-lg leading-relaxed">
            {question.prompt}
          </MathText>

          <QuestionFigures questionId={question.id} />

          {hasSolution && (
            <div className="mt-6 border-t border-dashed border-border pt-4">
              {!revealed ? (
                <Button variant="outline" onClick={() => setRevealed(true)}>
                  <Eye className="h-4 w-4" /> Reveal mark scheme
                </Button>
              ) : (
                <div className="flex animate-fade-in flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Mark scheme
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevealed(false)}
                    >
                      <EyeOff className="h-4 w-4" /> Hide
                    </Button>
                  </div>
                  {question.answer && (
                    <div className="border-l-2 border-success pl-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-success">
                        Answer
                      </p>
                      <MathText
                        as="p"
                        className="mt-1.5 font-serif text-[15px] leading-relaxed"
                      >
                        {question.answer}
                      </MathText>
                    </div>
                  )}
                  {question.solution && (
                    <div className="border-l-2 border-border pl-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        Worked solution
                      </p>
                      <MathText
                        as="p"
                        className="mt-1.5 font-serif text-[15px] leading-relaxed"
                      >
                        {question.solution}
                      </MathText>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {question.reviewer_name && (
            <p className="mt-6 font-mono text-2xs text-muted-foreground">
              Reviewed by {question.reviewer_name}
              {question.reviewer_credential
                ? `, ${question.reviewer_credential}`
                : ""}
            </p>
          )}

          {(question.source || question.license) && (
            <p className={cn("mt-6 font-mono text-2xs text-muted-foreground")}>
              {question.source}
              {question.source && question.license ? " · " : ""}
              {question.license}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
