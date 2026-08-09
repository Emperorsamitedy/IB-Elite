"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  PROGRESS_EVENT,
  matchChannel,
  type LadderStatus,
  type ProgressEvent,
} from "@/lib/ladder/types";

const TOTAL_QUESTIONS = 10;

type Props = {
  studentId: string;
  subjectId: string;
  subjectName: string;
  pusherKey: string;
  pusherCluster: string;
};

type Side = { questionIndex: number; correctCount: number; isComplete: boolean };

const EMPTY_SIDE: Side = { questionIndex: 0, correctCount: 0, isComplete: false };

export function LadderMatchup({
  studentId,
  subjectId,
  subjectName,
  pusherKey,
  pusherCluster,
}: Props) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<LadderStatus | null>(null);
  const [you, setYou] = useState<Side>(EMPTY_SIDE);
  const [opponent, setOpponent] = useState<Side>(EMPTY_SIDE);
  const [error, setError] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const socket = useRef<PusherClient | null>(null);

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
      if (!response.ok) throw new Error(payload.error ?? "Could not join the ladder");
      setMatchId(payload.matchId);
      setStatus(payload.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join the ladder");
    } finally {
      setQueueing(false);
    }
  }, [studentId, subjectId]);

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
        setStatus("ACTIVE");
      }
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(matchChannel(matchId));
      client.disconnect();
      socket.current = null;
    };
  }, [matchId, pusherKey, pusherCluster, studentId]);

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
              Race an opponent at your level through the same paper. You only ever
              see their position and score — never their work.
            </p>
            <Button onClick={findOpponent} disabled={queueing}>
              <Swords className="mr-2 size-4" />
              {queueing ? "Finding opponent…" : "Find opponent"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {matchId && (
        <Card>
          <CardContent className="flex flex-col gap-6 py-6">
            <p className="font-mono text-xs uppercase tracking-[0.08em]">
              {status === "WAITING"
                ? "Waiting for an opponent…"
                : status === "COMPLETE"
                  ? "Match complete"
                  : "Match live"}
            </p>
            <ProgressRow label="You" side={you} />
            <ProgressRow
              label={status === "WAITING" ? "Opponent (pending)" : "Opponent"}
              side={opponent}
            />
            {!pusherKey && (
              <p className="text-sm text-muted-foreground">
                Live updates are off until Pusher is configured.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProgressRow({ label, side }: { label: string; side: Side }) {
  const percent = Math.min(100, (side.questionIndex / TOTAL_QUESTIONS) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.08em]">
        <span>{label}</span>
        <span>
          Q{Math.min(side.questionIndex + 1, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS} ·{" "}
          {side.correctCount} correct
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
