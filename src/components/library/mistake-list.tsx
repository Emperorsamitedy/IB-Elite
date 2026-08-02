"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMistake, removeMistake } from "@/lib/actions/library";
import { cn } from "@/lib/utils";

export type MistakeRow = {
  questionId: string;
  prompt: string;
  topicName: string | null;
  resolved: boolean;
};

export function MistakeList({ items }: { items: MistakeRow[] }) {
  const [rows, setRows] = React.useState(items);
  const [pending, start] = React.useTransition();

  const resolve = (id: string, resolved: boolean) =>
    start(async () => {
      setRows((r) =>
        r.map((x) => (x.questionId === id ? { ...x, resolved } : x)),
      );
      await resolveMistake(id, resolved);
      toast.success(resolved ? "Marked as resolved" : "Reopened");
    });

  const remove = (id: string) =>
    start(async () => {
      setRows((r) => r.filter((x) => x.questionId !== id));
      await removeMistake(id);
      toast.success("Removed from notebook");
    });

  return (
    <ul className="divide-y divide-border border-y border-border">
      {rows.map((m) => (
        <li
          key={m.questionId}
          className={cn(
            "flex items-center gap-4 py-3.5",
            m.resolved && "opacity-55",
          )}
        >
          <span
            className={cn(
              "h-8 w-1 shrink-0 rounded-[1px]",
              m.resolved ? "bg-success" : "bg-accent",
            )}
          />
          <Link
            href={`/questions/${m.questionId}`}
            className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="line-clamp-1 font-serif text-[15px] hover:text-accent">
              {m.prompt}
            </p>
            {m.topicName && (
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                {m.topicName}
              </p>
            )}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => resolve(m.questionId, !m.resolved)}
              aria-label={m.resolved ? "Reopen" : "Resolve"}
            >
              {m.resolved ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4 text-success" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => remove(m.questionId)}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
