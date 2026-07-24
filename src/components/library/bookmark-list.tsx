"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BookmarkX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleBookmark } from "@/lib/actions/library";
import type { Difficulty } from "@/lib/types";

const DIFF_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
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
    <div className="flex flex-col gap-2.5">
      {rows.map((b) => (
        <Card key={b.questionId}>
          <CardContent className="flex items-center gap-4 p-4">
            <Link href={`/questions/${b.questionId}`} className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium">{b.prompt}</p>
              <div className="mt-1.5 flex items-center gap-2">
                {b.topicName && (
                  <Badge variant="outline">{b.topicName}</Badge>
                )}
                <Badge
                  variant={DIFF_VARIANT[b.difficulty]}
                  className="capitalize"
                >
                  {b.difficulty}
                </Badge>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => remove(b.questionId)}
              aria-label="Remove bookmark"
            >
              <BookmarkX className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
