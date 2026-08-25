"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Play, Send, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MathText } from "@/components/ui/math-text";
import { Spinner } from "@/components/ui/misc";
import { messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";

const t = messages.mock;

type Paper = { title: string; body: string; durationMinutes: number };

/**
 * The exam room: start at the bell, write on paper, photograph pages,
 * submit before the deadline. The server owns every timestamp — this
 * component only renders them.
 */
export function MockRoom({
  sittingId,
  initialStatus,
  initialPages,
}: {
  sittingId: string;
  initialStatus: "entered" | "started" | "done";
  initialPages: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState(initialStatus);
  const [paper, setPaper] = React.useState<Paper | null>(null);
  const [deadline, setDeadline] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState(initialPages);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mock/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sittingId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not start");
      setPaper(body.paper);
      setDeadline(body.deadline);
      setPhase("started");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  // Re-entering the room mid-exam recovers the paper and deadline.
  React.useEffect(() => {
    if (initialStatus === "started" && !paper) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("sittingId", sittingId);
      const res = await fetch("/api/mock/scripts", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      setPages(body.pages);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mock/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sittingId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not submit");
      toast.success(
        body.entry.status === "late" ? t.submittedLate : t.submitted,
      );
      setPhase("done");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "done") return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        {phase === "entered" && (
          <>
            <p className="text-sm text-muted-foreground">{t.handwrittenNote}</p>
            <Button onClick={() => void start()} disabled={busy} className="self-start">
              {busy ? <Spinner /> : <Play className="mr-2 size-4" />}
              {t.start}
            </Button>
          </>
        )}

        {phase === "started" && (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.08em]">
                {t.started}
              </span>
              {deadline && (
                <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
                  <Timer className="h-3.5 w-3.5" />
                  <Countdown to={deadline} className={cn("font-semibold")} />
                </span>
              )}
            </div>

            {paper ? (
              <div className="rounded-lg border border-border bg-surface-2/50 p-5">
                <h2 className="font-bold tracking-tight">{paper.title}</h2>
                <MathText className="mt-3 font-serif text-[15px] leading-relaxed">
                  {paper.body}
                </MathText>
              </div>
            ) : (
              <Spinner />
            )}

            <p className="text-sm text-muted-foreground">{t.handwrittenNote}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <Camera className="mr-2 size-4" /> {t.uploadPage}
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                {pages} {t.pages}
              </span>
              <Button
                onClick={() => void submit()}
                disabled={busy || pages === 0}
                className="ml-auto"
              >
                {busy ? <Spinner /> : <Send className="mr-2 size-4" />}
                {t.submit}
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
