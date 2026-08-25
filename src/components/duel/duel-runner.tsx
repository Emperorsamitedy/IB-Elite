"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Swords, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MathText } from "@/components/ui/math-text";
import { messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";

const t = messages.duel;
const POLL_MS = 3000;

type Side = {
  answered: number;
  correct: number;
  totalTimeMs: number;
  isComplete: boolean;
  displayName?: string | null;
};

type CurrentQuestion = {
  index: number;
  id: string;
  title: string | null;
  prompt: string;
  marks: number;
  difficulty: string;
  answerType: string;
  options: string[] | null;
  servedAt: string;
  budgetMs: number;
};

type ReviewRow = {
  index: number;
  prompt: string;
  yourAnswer: string | null;
  isCorrect: boolean;
  modelAnswer: string | null;
  questionId: string;
};

type MatchPayload = {
  match: {
    id: string;
    subject_id: string;
    mode: "ranked" | "friendly";
    status: "WAITING" | "ACTIVE" | "COMPLETE";
  };
  you: Side;
  opponent: Side | null;
  totalQuestions: number;
  currentQuestion: CurrentQuestion | null;
  verdict: { result: "won" | "lost" | "drew" } | null;
  review: ReviewRow[] | null;
};

export function DuelRunner({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<MatchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const questionRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/duel/match/${matchId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not load the match");
      return;
    }
    const payload = (await res.json()) as MatchPayload;
    setState(payload);
    if (payload.currentQuestion?.id !== questionRef.current) {
      questionRef.current = payload.currentQuestion?.id ?? null;
      setAnswer("");
      setChosen(null);
      setLastResult(null);
    }
  }, [matchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while the match is live or an opponent is still finishing.
  useEffect(() => {
    if (state?.match.status === "COMPLETE") return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [state?.match.status, refresh]);

  // Per-question countdown from the server's served_at stamp.
  useEffect(() => {
    const question = state?.currentQuestion;
    if (!question) {
      setSecondsLeft(null);
      return;
    }
    const deadline = new Date(question.servedAt).getTime() + question.budgetMs;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [state?.currentQuestion]);

  const submit = useCallback(async () => {
    const question = state?.currentQuestion;
    if (!question || submitting) return;
    const value = question.answerType === "mcq" ? String(chosen ?? "") : answer;
    if (!value.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/duel/match/${matchId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex: question.index, answer: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not submit");
      setLastResult(body.isCorrect);
      // Brief verdict flash, then the next question arrives with the poll.
      setTimeout(() => void refresh(), 700);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }, [state, submitting, chosen, answer, matchId, refresh]);

  const rematch = useCallback(async () => {
    if (!state) return;
    const res = await fetch("/api/duel/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId: state.match.subject_id,
        mode: state.match.mode,
        opponentId: null,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(body?.error ?? "Could not create the rematch");
      return;
    }
    await navigator.clipboard.writeText(body.url).catch(() => {});
    toast.success(t.linkCopied);
  }, [state]);

  if (error && !state) {
    return <p className="text-sm text-danger">{error}</p>;
  }
  if (!state) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  const { you, opponent, totalQuestions, currentQuestion, verdict } = state;
  const youDone = you.isComplete || you.answered >= totalQuestions;

  return (
    <div className="flex flex-col gap-5">
      {state.match.mode === "friendly" && (
        <Badge variant="outline" className="w-fit">
          {t.friendlyNote}
        </Badge>
      )}

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-[0.08em]">
              {state.match.status === "COMPLETE"
                ? t.finished
                : youDone
                  ? t.waitingOpponent
                  : t.matchLive}
            </span>
            {secondsLeft !== null && !youDone && (
              <span
                role="timer"
                aria-live="off"
                aria-label={t.timeLeft}
                className={cn(
                  "flex items-center gap-1.5 font-mono text-sm tabular-nums",
                  secondsLeft <= 10 && "text-danger",
                )}
              >
                <Timer className="h-3.5 w-3.5" />
                {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <SideRow label={t.you} side={you} total={totalQuestions} />
          <SideRow
            label={opponent?.displayName ?? t.opponent}
            side={opponent}
            total={totalQuestions}
          />
        </CardContent>
      </Card>

      {currentQuestion && !youDone && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                {t.question} {currentQuestion.index + 1} / {totalQuestions}
              </span>
              <span className="flex gap-2">
                <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                <Badge variant="outline">{currentQuestion.marks} marks</Badge>
              </span>
            </div>

            {currentQuestion.title && (
              <h2 className="font-bold tracking-tight">{currentQuestion.title}</h2>
            )}
            <MathText className="font-serif text-[15px] leading-relaxed">
              {currentQuestion.prompt}
            </MathText>

            {lastResult !== null ? (
              <p
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  lastResult ? "text-success" : "text-danger",
                )}
              >
                {lastResult ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {lastResult ? t.correct : t.incorrect}
              </p>
            ) : currentQuestion.answerType === "mcq" &&
              currentQuestion.options ? (
              <div className="flex flex-col gap-2">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setChosen(i)}
                    className={cn(
                      "rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                      chosen === i
                        ? "border-accent bg-accent/10 font-medium"
                        : "border-border hover:bg-surface-2",
                    )}
                  >
                    <MathText as="span">{option}</MathText>
                  </button>
                ))}
              </div>
            ) : (
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t.answerPlaceholder}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                autoFocus
              />
            )}

            {lastResult === null && (
              <div className="flex justify-end">
                <Button
                  onClick={() => void submit()}
                  disabled={
                    submitting ||
                    (currentQuestion.answerType === "mcq"
                      ? chosen === null
                      : !answer.trim())
                  }
                >
                  {t.submit}
                </Button>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
          </CardContent>
        </Card>
      )}

      {state.match.status === "COMPLETE" && verdict && (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-8">
            <p className="flex items-center gap-2 text-lg font-bold">
              <Trophy className="size-5 text-accent" />
              {verdict.result === "won"
                ? t.youWon
                : verdict.result === "lost"
                  ? t.youLost
                  : t.youDrew}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.you} {you.correct}/{totalQuestions} ·{" "}
              {opponent?.displayName ?? t.opponent} {opponent?.correct ?? 0}/
              {totalQuestions}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push(`/ladder/${state.match.subject_id}`)}>
                <Swords className="mr-2 size-4" /> {t.playAgain}
              </Button>
              <Button variant="secondary" onClick={() => void rematch()}>
                <Copy className="mr-2 size-4" /> {t.challengeFriend}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {state.match.status === "COMPLETE" && state.review && state.review.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <h2 className="text-sm font-semibold">{t.reviewTitle}</h2>
            {state.review.map((row) => (
              <div
                key={row.index}
                className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <MathText className="min-w-0 flex-1 text-sm">
                    {row.prompt}
                  </MathText>
                  {row.isCorrect ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.yourAnswer}:{" "}
                  <span className={cn(row.isCorrect ? "text-success" : "text-danger")}>
                    {row.yourAnswer || "—"}
                  </span>
                  {!row.isCorrect && row.modelAnswer && (
                    <>
                      {" · "}
                      {t.correctAnswer}:{" "}
                      <span className="text-foreground">{row.modelAnswer}</span>
                    </>
                  )}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SideRow({
  label,
  side,
  total,
}: {
  label: string;
  side: Side | null;
  total: number;
}) {
  const answered = side?.answered ?? 0;
  const percent = total > 0 ? Math.min(100, (answered / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.08em]">
        <span>{label}</span>
        <span>
          {side?.isComplete
            ? `${t.finished} · ${side.correct} ✓`
            : `${answered} / ${total} · ${side?.correct ?? 0} ✓`}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
