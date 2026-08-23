"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";
import { Check, Eye, Swords, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MathText } from "@/components/ui/math-text";
import { Badge } from "@/components/ui/badge";
import {
  PROGRESS_EVENT,
  matchChannel,
  type LadderStatus,
  type ProgressEvent,
} from "@/lib/ladder/types";

type Props = {
  studentId: string;
  subjectId: string;
  subjectName: string;
  pusherKey: string;
  pusherCluster: string;
};

type Side = { questionIndex: number; correctCount: number; isComplete: boolean };

type MatchQuestion = {
  id: string;
  title: string | null;
  prompt: string;
  answer: string | null;
  solution: string | null;
  marks: number;
  difficulty: string;
};

type MatchState = {
  match: {
    id: string;
    status: LadderStatus;
    student_a_id: string;
    student_b_id: string | null;
  };
  progress: {
    student_id: string;
    current_question_index: number;
    correct_count: number;
    is_complete: boolean;
  }[];
  questions: MatchQuestion[];
};

const EMPTY_SIDE: Side = { questionIndex: 0, correctCount: 0, isComplete: false };

/** How often to re-fetch match state when Pusher isn't pushing it to us. */
const POLL_MS = 4000;

export function LadderMatchup({
  studentId,
  subjectId,
  subjectName,
  pusherKey,
  pusherCluster,
}: Props) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<LadderStatus | null>(null);
  const [questions, setQuestions] = useState<MatchQuestion[]>([]);
  const [you, setYou] = useState<Side>(EMPTY_SIDE);
  const [opponent, setOpponent] = useState<Side>(EMPTY_SIDE);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const socket = useRef<PusherClient | null>(null);

  const applyState = useCallback(
    (state: MatchState) => {
      setStatus(state.match.status);
      setQuestions(state.questions);
      for (const row of state.progress) {
        const side: Side = {
          questionIndex: row.current_question_index,
          correctCount: row.correct_count,
          isComplete: row.is_complete,
        };
        if (row.student_id === studentId) setYou(side);
        else setOpponent(side);
      }
    },
    [studentId],
  );

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const response = await fetch(`/api/ladder/match/${matchId}`);
    if (!response.ok) return;
    applyState((await response.json()) as MatchState);
  }, [matchId, applyState]);

  const findOpponent = useCallback(async () => {
    setQueueing(true);
    setError(null);
    try {
      const response = await fetch("/api/ladder/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subjectId }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Could not join the ladder");
      setMatchId(payload.matchId);
      setStatus(payload.status);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not join the ladder",
      );
    } finally {
      setQueueing(false);
    }
  }, [studentId, subjectId]);

  // Full state on entry, then whenever the match id changes.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live opponent updates when Pusher is configured.
  useEffect(() => {
    if (!matchId || !pusherKey || !pusherCluster) return;

    const client = new PusherClient(pusherKey, { cluster: pusherCluster });
    socket.current = client;
    const channel = client.subscribe(matchChannel(matchId));
    channel.bind(PROGRESS_EVENT, (event: ProgressEvent) => {
      const side: Side = {
        questionIndex: event.questionIndex,
        correctCount: event.correctCount,
        isComplete: event.isComplete,
      };
      if (event.studentId === studentId) setYou(side);
      else {
        setOpponent(side);
        setStatus((s) => (s === "WAITING" ? "ACTIVE" : s));
      }
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(matchChannel(matchId));
      client.disconnect();
      socket.current = null;
    };
  }, [matchId, pusherKey, pusherCluster, studentId]);

  // Polling covers what events can't: opponent joining, missed events, and
  // every update on installs without Pusher.
  useEffect(() => {
    if (!matchId || status === "COMPLETE") return;
    const everything = !pusherKey;
    if (!everything && status !== "WAITING" && !you.isComplete) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [matchId, status, pusherKey, you.isComplete, refresh]);

  const total = questions.length;
  const current = questions[you.questionIndex];
  const finished = you.isComplete || (total > 0 && you.questionIndex >= total);

  const mark = useCallback(
    async (isCorrect: boolean) => {
      if (!matchId || !current || submitting) return;
      setSubmitting(true);
      setError(null);
      const nextIndex = you.questionIndex + 1;
      try {
        const response = await fetch("/api/ladder/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            studentId,
            questionIndex: nextIndex,
            isCorrect,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Could not save your answer");
        }
        const correctCount = you.correctCount + (isCorrect ? 1 : 0);
        setYou({ questionIndex: nextIndex, correctCount, isComplete: false });
        setRevealed(false);

        if (nextIndex >= total) {
          const done = await fetch("/api/ladder/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId, studentId, finalScore: correctCount }),
          });
          if (!done.ok) {
            const payload = await done.json().catch(() => null);
            throw new Error(payload?.error ?? "Could not finish the match");
          }
          setYou((y) => ({ ...y, isComplete: true }));
          void refresh();
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [matchId, current, submitting, you, studentId, total, refresh],
  );

  const bothDone = finished && opponent.isComplete;
  const won = you.correctCount > opponent.correctCount;
  const drew = you.correctCount === opponent.correctCount;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">World Ladder</h1>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {subjectName} · same paper, head to head
        </p>
      </div>

      {!matchId && (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-8">
            <p className="max-w-prose text-sm text-muted-foreground">
              Race an opponent at your level through the same paper. You only
              ever see their position and score — never their work.
            </p>
            <Button onClick={findOpponent} disabled={queueing}>
              <Swords className="mr-2 size-4" />
              {queueing ? "Finding opponent…" : "Find opponent"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </CardContent>
        </Card>
      )}

      {matchId && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-6 py-6">
              <p className="font-mono text-xs uppercase tracking-[0.08em]">
                {status === "WAITING"
                  ? "Waiting for an opponent… you can start already"
                  : status === "COMPLETE" || bothDone
                    ? "Match complete"
                    : "Match live"}
              </p>
              <ProgressRow label="You" side={you} total={total} />
              <ProgressRow
                label={status === "WAITING" ? "Opponent (pending)" : "Opponent"}
                side={opponent}
                total={total}
              />
            </CardContent>
          </Card>

          {current && !finished && (
            <Card>
              <CardContent className="flex flex-col gap-4 py-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    Question {you.questionIndex + 1} of {total}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{current.difficulty}</Badge>
                    <Badge variant="outline">
                      {current.marks} mark{current.marks === 1 ? "" : "s"}
                    </Badge>
                  </span>
                </div>

                {current.title && (
                  <h2 className="font-bold tracking-tight">{current.title}</h2>
                )}
                <MathText className="font-serif text-[15px] leading-relaxed">
                  {current.prompt}
                </MathText>

                {!revealed ? (
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={() => setRevealed(true)}>
                      <Eye className="mr-2 size-4" /> Reveal answer
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-border bg-surface-2 p-4">
                      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                        Answer
                      </p>
                      <MathText className="mt-1.5 font-serif text-[15px] leading-relaxed">
                        {current.answer ?? current.solution ?? "No model answer recorded."}
                      </MathText>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Be honest — your score is only worth what your marking is.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void mark(false)}
                        disabled={submitting}
                      >
                        <X className="mr-2 size-4" /> I got it wrong
                      </Button>
                      <Button onClick={() => void mark(true)} disabled={submitting}>
                        <Check className="mr-2 size-4" /> I got it right
                      </Button>
                    </div>
                  </>
                )}
                {error && <p className="text-sm text-danger">{error}</p>}
              </CardContent>
            </Card>
          )}

          {finished && (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-8">
                {bothDone ? (
                  <>
                    <p className="flex items-center gap-2 text-lg font-bold">
                      <Trophy className="size-5 text-accent" />
                      {drew
                        ? "It's a draw."
                        : won
                          ? "You won!"
                          : "Your opponent took this one."}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You {you.correctCount} · Opponent {opponent.correctCount}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold">
                      Done — {you.correctCount} of {total} correct.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Waiting for your opponent to finish…
                    </p>
                  </>
                )}
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  <Swords className="mr-2 size-4" /> Play again
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ProgressRow({
  label,
  side,
  total,
}: {
  label: string;
  side: Side;
  total: number;
}) {
  const denominator = total || 1;
  const percent = Math.min(100, (side.questionIndex / denominator) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.08em]">
        <span>{label}</span>
        <span>
          {side.isComplete
            ? `Finished · ${side.correctCount} correct`
            : `Q${Math.min(side.questionIndex + 1, denominator)} / ${total || "—"} · ${side.correctCount} correct`}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
