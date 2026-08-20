"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Send, X, Minimize2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { useAssistant } from "@/components/assistant/assistant-provider";
import { contextChips, quickActions } from "@/lib/assistant";
import { cn } from "@/lib/utils";

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** Set on assistant replies assembled from the mark scheme rather than generated. */
  fromMarkScheme?: boolean;
};

/**
 * Floating assistant, mounted once for the whole app. It opens in place on
 * whatever screen the student is on and sends that screen as context, so it
 * never has to ask where they are.
 */
export function AssistantDock() {
  const { context } = useAssistant();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string>();
  const [hintLevel, setHintLevel] = React.useState(0);
  const [limitHit, setLimitHit] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const chips = contextChips(context);
  const actions = quickActions(context);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A conversation is bound to the question it started on.
  React.useEffect(() => {
    setConversationId(undefined);
    setHintLevel(0);
  }, [context.questionId]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: context.questionId ?? undefined,
          conversationId,
          message: text,
          hintLevel,
          context: {
            page: context.page,
            path: context.path,
            subject: context.subject,
            topic: context.topic,
            detail: context.detail,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setLimitHit(true);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.message },
        ]);
        return;
      }
      if (res.status === 503) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "The AI assistant is offline right now, so I can't answer this. Nothing here is generated for you in the meantime.",
          },
        ]);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "failed");
      setConversationId(data.conversationId);
      setHintLevel(data.hintLevel ?? hintLevel);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply,
          fromMarkScheme: data.source === "heuristic",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Sorry — I couldn't respond just now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the AI assistant"
        className="fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-ink-foreground shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-foreground dark:text-background md:bottom-6"
      >
        <Sparkles className="size-4" />
        <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
          Ask Atlas
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex h-[min(34rem,75vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:bottom-6">
      <div className="flex items-start gap-2 border-b border-border bg-ink px-4 py-3 text-ink-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.12em] leading-none">
            Atlas
          </p>
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="max-w-full truncate rounded border border-ink-foreground/25 px-1.5 py-0.5 text-2xs text-ink-foreground/80"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimise the assistant"
          className="rounded p-1 text-ink-foreground/70 transition-colors hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {messages.length > 0 ? (
            <Minimize2 className="size-4" />
          ) : (
            <X className="size-4" />
          )}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            I can see where you are. Ask about this screen, your revision plan,
            or anything you&apos;re stuck on.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto rounded-br-sm bg-accent text-accent-foreground"
                : "rounded-bl-sm border border-border bg-surface",
            )}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.fromMarkScheme && (
              <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-1.5 text-2xs text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                Guided from the mark scheme
              </p>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Thinking…
          </div>
        )}
      </div>

      {limitHit ? (
        <div className="border-t border-border p-4">
          <Button asChild className="w-full">
            <Link href="/settings/billing">Upgrade to Pro</Link>
          </Button>
        </div>
      ) : (
        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => send(action)}
                disabled={loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {action}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Atlas…"
              className="h-10 flex-1 rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
