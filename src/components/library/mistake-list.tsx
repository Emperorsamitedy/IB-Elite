"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveMistake, removeMistake } from "@/lib/actions/library";

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
    <div className="flex flex-col gap-2.5">
      {rows.map((m) => (
        <Card key={m.questionId} className={m.resolved ? "opacity-60" : ""}>
          <CardContent className="flex items-center gap-4 p-4">
            <Link
              href={`/questions/${m.questionId}`}
              className="min-w-0 flex-1"
            >
              <p className="line-clamp-1 text-sm font-medium">{m.prompt}</p>
              {m.topicName && (
                <Badge variant="outline" className="mt-1.5">
                  {m.topicName}
                </Badge>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
