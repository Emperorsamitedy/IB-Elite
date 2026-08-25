"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/misc";
import { messages } from "@/lib/i18n/en";

const t = messages.duel;
const POLL_MS = 3000;

export function DuelQueue({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopped = useRef(false);

  const handleOutcome = useCallback(
    (outcome: { status: string; match?: { id: string } }) => {
      if (outcome.status === "matched" && outcome.match) {
        stopped.current = true;
        router.push(`/duel/${outcome.match.id}`);
        return true;
      }
      return false;
    },
    [router],
  );

  const start = useCallback(
    async (mode: "ranked" | "friendly") => {
      setError(null);
      setSearching(true);
      stopped.current = false;
      try {
        const res = await fetch("/api/duel/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId, mode }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Could not join the queue");
        if (handleOutcome(body)) return;
      } catch (cause) {
        setSearching(false);
        setError(cause instanceof Error ? cause.message : "Could not queue");
      }
    },
    [subjectId, handleOutcome],
  );

  // Poll while searching: pairing re-runs server-side as windows widen.
  useEffect(() => {
    if (!searching) return;
    const timer = setInterval(async () => {
      if (stopped.current) return;
      const res = await fetch(`/api/duel/queue?subjectId=${subjectId}`);
      if (!res.ok) return;
      handleOutcome(await res.json());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [searching, subjectId, handleOutcome]);

  const cancel = useCallback(async () => {
    stopped.current = true;
    setSearching(false);
    await fetch(`/api/duel/queue?subjectId=${subjectId}`, { method: "DELETE" });
  }, [subjectId]);

  const challengeLink = useCallback(async () => {
    const res = await fetch("/api/duel/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, mode: "friendly" }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(body?.error ?? "Could not create the link");
      return;
    }
    await navigator.clipboard.writeText(body.url).catch(() => {});
    toast.success(t.linkCopied);
  }, [subjectId]);

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 py-8">
        {searching ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <Spinner /> {t.searching}
            </p>
            <p className="text-xs text-muted-foreground">{t.searchingHint}</p>
            <Button variant="outline" onClick={() => void cancel()}>
              {t.cancelSearch}
            </Button>
          </>
        ) : (
          <>
            <p className="max-w-prose text-sm text-muted-foreground">
              {t.subtitle}. {t.friendlyNote}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void start("ranked")}>
                <Swords className="mr-2 size-4" /> {t.findRanked}
              </Button>
              <Button variant="secondary" onClick={() => void start("friendly")}>
                <Users className="mr-2 size-4" /> {t.findFriendly}
              </Button>
              <Button variant="outline" onClick={() => void challengeLink()}>
                <Copy className="mr-2 size-4" /> {t.challengeFriend}
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
