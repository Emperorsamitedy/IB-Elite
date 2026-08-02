"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquareText, Send, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK = [
  "Give me a hint",
  "Explain the concept",
  "Show me the next step",
  "I'm stuck",
];

export function TutorPanel({
  questionId,
  className,
}: {
  questionId: string;
  className?: string;
}) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string>();
  const [hintLevel, setHintLevel] = React.useState(0);
  const [limitHit, setLimitHit] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

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
          questionId,
          conversationId,
          message: text,
          hintLevel,
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setLimitHit(true);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.message },
        ]);
        return;
      }
      if (!res.ok) throw new Error();
      setConversationId(data.conversationId);
      setHintLevel(data.hintLevel);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
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

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2.5 border-b border-border bg-ink-2 px-4 py-3 text-ink-foreground">
        <MessageSquareText className="h-4 w-4" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] leading-none">
            Tutor
          </p>
          <p className="mt-1 text-2xs text-ink-foreground/70">
            Guided hints, not answers
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Stuck? Ask for a hint and I&apos;ll guide you step by step.
            </p>
          </div>
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
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {q}
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
              placeholder="Ask the tutor…"
              className="h-10 flex-1 rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
