"use client";

import * as React from "react";
import { Camera, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type {
  SolveStep,
  SolveVerdict,
  SourceCitation,
} from "@/lib/curriculumsolve/types";

type Result = {
  sessionId: string;
  verdict: SolveVerdict;
  steps: SolveStep[];
  sourceCitations: SourceCitation[];
};

const VERDICT_LABEL: Record<SolveVerdict, string> = {
  CORRECT: "Correct",
  PARTIAL: "Partially correct",
  INCORRECT: "Incorrect",
  OUT_OF_SYLLABUS_SCOPE: "Outside syllabus scope",
  INSUFFICIENT_DATA: "Not enough curriculum data",
};

const VERDICT_TONE: Record<
  SolveVerdict,
  "success" | "warning" | "danger" | "outline"
> = {
  CORRECT: "success",
  PARTIAL: "warning",
  INCORRECT: "danger",
  OUT_OF_SYLLABUS_SCOPE: "warning",
  INSUFFICIENT_DATA: "outline",
};

export function SolvePanel({
  isPro,
  freeLimit,
}: {
  isPro: boolean;
  freeLimit: number;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  // Steps are revealed one at a time so the student reads the reasoning
  // rather than scrolling to the answer.
  const [revealed, setRevealed] = React.useState(0);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setResult(null);
    setRevealed(0);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/curriculumsolve/upload", {
        method: "POST",
        body,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "Solve failed");
        return;
      }
      const detail = await fetch(`/api/curriculumsolve/${payload.sessionId}`);
      const session = await detail.json();
      setResult(session as Result);
      setNotice(payload.message ?? null);
      setRevealed(session.steps?.length ? 1 : 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Solve failed");
    } finally {
      setBusy(false);
    }
  };

  const complete = React.useCallback(async (sessionId: string) => {
    await fetch(`/api/curriculumsolve/${sessionId}/complete`, {
      method: "POST",
    });
  }, []);

  const allRevealed = result ? revealed >= result.steps.length : false;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 py-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="solve-file">Photo of the problem</Label>
            <input
              id="solve-file"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              JPG or PNG up to 1 MB ·{" "}
              {isPro ? "Unlimited solves" : `${freeLimit} free solves a day`}
            </p>
          </div>
          <Button onClick={submit} disabled={!file || busy}>
            <Camera className="mr-2 size-4" />
            {busy ? "Reading and grading…" : "Solve and grade"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="flex flex-col gap-5 py-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Verdict
              </p>
              <Badge variant={VERDICT_TONE[result.verdict]}>
                {VERDICT_LABEL[result.verdict]}
              </Badge>
            </div>

            {result.verdict === "INSUFFICIENT_DATA" ? (
              <p className="text-sm text-muted-foreground">
                {notice ??
                  "This topic isn't indexed with curriculum data yet, so there is nothing to grade against."}
              </p>
            ) : (
              <>
                <ol className="flex flex-col gap-3">
                  {result.steps.slice(0, revealed).map((step, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-surface-2 p-4"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                        Step {i + 1}
                      </p>
                      <p className="mt-1 font-semibold tracking-tight">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.body}
                      </p>
                    </li>
                  ))}
                </ol>

                {!allRevealed ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = revealed + 1;
                      setRevealed(next);
                      if (next >= result.steps.length) {
                        void complete(result.sessionId);
                      }
                    }}
                  >
                    Next step <ArrowRight className="ml-2 size-4" />
                  </Button>
                ) : null}

                {result.sourceCitations.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      Based on
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {result.sourceCitations.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Badge
                            variant={
                              c.confidence === "syllabus_guide"
                                ? "accent"
                                : "outline"
                            }
                          >
                            {c.confidence === "syllabus_guide"
                              ? "Syllabus guide"
                              : "Similar question"}
                          </Badge>
                          <span className="text-muted-foreground">
                            {c.excerpt_summary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
