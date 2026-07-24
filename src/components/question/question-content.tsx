"use client";

import * as React from "react";
import { Eye, EyeOff, Calculator, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  topics?: { name: string } | null;
};

const DIFF_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

export function QuestionContent({
  question,
  revealDefault = false,
}: {
  question: QuestionForViewer;
  revealDefault?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(revealDefault);
  const hasSolution = Boolean(question.answer || question.solution);

  React.useEffect(() => setRevealed(revealDefault), [question.id, revealDefault]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={DIFF_VARIANT[question.difficulty]} className="capitalize">
          {question.difficulty}
        </Badge>
        <Badge variant="outline">
          {question.marks} {question.marks === 1 ? "mark" : "marks"}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {question.question_type.replace(/-/g, " ")}
        </Badge>
        {question.calculator !== null && (
          <Badge variant="outline">
            <Calculator className="h-3 w-3" />
            {question.calculator ? "Calculator" : "No calculator"}
          </Badge>
        )}
        {question.paper && <Badge variant="outline">{question.paper}</Badge>}
        {question.year && <Badge variant="outline">{question.year}</Badge>}
      </div>

      {question.title && (
        <h2 className="text-lg font-semibold tracking-tight">
          {question.title}
        </h2>
      )}

      <div className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground">
        {question.prompt}
      </div>

      {hasSolution && (
        <div className="border-t border-border pt-4">
          {!revealed ? (
            <Button variant="secondary" onClick={() => setRevealed(true)}>
              <Eye className="h-4 w-4" /> Reveal answer & solution
            </Button>
          ) : (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> Mark scheme
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
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-success">
                    Answer
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {question.answer}
                  </p>
                </div>
              )}
              {question.solution && (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Worked solution
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {question.solution}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(question.source || question.license) && (
        <p className={cn("text-2xs text-muted-foreground")}>
          {question.source}
          {question.source && question.license ? " · " : ""}
          {question.license}
        </p>
      )}
    </div>
  );
}
