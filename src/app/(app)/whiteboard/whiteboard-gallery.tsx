"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WhiteboardSummary } from "@/lib/whiteboard/types";

export function WhiteboardGallery({
  whiteboards,
}: {
  whiteboards: WhiteboardSummary[];
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  const create = async () => {
    setCreating(true);
    const created = await fetch("/api/whiteboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled whiteboard" }),
    }).then((r) => r.json());
    router.push(`/whiteboard/${created.id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={create} disabled={creating}>
          <Plus className="mr-2 size-4" />
          {creating ? "Creating…" : "New whiteboard"}
        </Button>
      </div>

      {whiteboards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No whiteboards yet. Start one to sketch out a problem.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {whiteboards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/whiteboard/${board.id}`}
                className="block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-accent"
              >
                <div className="relative aspect-[16/9] bg-white">
                  {board.thumbnailUrl && (
                    <Image
                      src={board.thumbnailUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {board.title ?? "Untitled whiteboard"}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {new Date(board.updatedAt).toLocaleString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
