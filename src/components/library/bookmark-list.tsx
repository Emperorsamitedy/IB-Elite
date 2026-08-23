"use client";

import * as React from "react";
import { MathText } from "@/components/ui/math-text";
import Link from "next/link";
import { toast } from "sonner";
import { BookmarkX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleBookmark } from "@/lib/actions/library";
import type { Difficulty } from "@/lib/types";

const DIFF_VARIANT: Record<Difficulty, "success" | "outline" | "danger"> = {
  easy: "success",
  medium: "outline",
  hard: "danger",
};

export type BookmarkRow = {
  questionId: string;
  prompt: string;
  topicName: string | null;
  difficulty: Difficulty;
};

export function BookmarkList({ items }: { items: BookmarkRow[] }) {
  const [rows, setRows] = React.useState(items);
  const [pending, start] = React.useTransition();

  const remove = (id: string) =>
    start(async () => {
      setRows((r) => r.filter((x) => x.questionId !== id));
      await toggleBookmark(id);
      toast.success("Bookmark removed");
    });

  return (
    <ul className="divide-y divide-border border-y border-border">
      {rows.map((b) => (
        <li key={b.questionId} className="flex items-center gap-4 py-3.5">
          <Link
            href={`/questions/${b.questionId}`}
            className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MathText
              as="p"
              className="line-clamp-1 font-serif text-[15px] hover:text-accent"
            >
              {b.prompt}
            </MathText>
            {b.topicName && (
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                {b.topicName}
              </p>
            )}
          </Link>
          <Badge variant={DIFF_VARIANT[b.difficulty]} className="shrink-0">
            {b.difficulty}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            onClick={() => remove(b.questionId)}
            aria-label="Remove bookmark"
          >
            <BookmarkX className="h-4 w-4 text-muted-foreground" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
