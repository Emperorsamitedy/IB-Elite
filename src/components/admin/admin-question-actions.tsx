"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Eye, Archive, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setQuestionStatus } from "@/lib/actions/admin";
import type { ContentStatus } from "@/lib/types";

export function AdminQuestionActions({
  id,
  status,
}: {
  id: string;
  status: ContentStatus;
}) {
  const [pending, start] = React.useTransition();

  const change = (next: ContentStatus) =>
    start(async () => {
      const res = await setQuestionStatus(id, next);
      if (res?.error) toast.error(res.error);
      else toast.success(`Marked as ${next}`);
    });

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" asChild aria-label="Edit">
        <Link href={`/admin/questions/${id}`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      {status !== "published" && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => change("published")}
          aria-label="Publish"
        >
          <Eye className="h-4 w-4 text-success" />
        </Button>
      )}
      {status !== "archived" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => change("archived")}
          aria-label="Archive"
        >
          <Archive className="h-4 w-4 text-muted-foreground" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => change("draft")}
          aria-label="Restore"
        >
          <Undo2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
