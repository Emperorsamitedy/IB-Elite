"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { CanvasData } from "@/lib/whiteboard/types";

// The board is canvas-only, so there is nothing to render on the server.
const WhiteboardCanvas = dynamic(() => import("./whiteboard-canvas"), {
  ssr: false,
  loading: () => (
    <p className="p-6 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      Loading whiteboard…
    </p>
  ),
});

type Loaded = { id: string; canvasData: CanvasData | null };

/**
 * Reopens this student's most recent board for the question, creating one on
 * first use, so working-out survives leaving and returning to the question.
 */
export function ShowYourWork({ questionId }: { questionId: string }) {
  const [board, setBoard] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const open = async () => {
      try {
        const existing = await fetch(
          `/api/whiteboard/question/${questionId}`,
        ).then((r) => r.json());
        const latest = existing.whiteboards?.[0];

        if (latest) {
          const full = await fetch(`/api/whiteboard/${latest.id}`).then((r) =>
            r.json(),
          );
          if (!cancelled) setBoard({ id: full.id, canvasData: full.canvasData });
          return;
        }

        const created = await fetch("/api/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId }),
        }).then((r) => r.json());
        if (!cancelled) setBoard({ id: created.id, canvasData: null });
      } catch {
        if (!cancelled) setError("Couldn't open the whiteboard.");
      }
    };

    void open();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Show your work
      </h2>
      {error && <p className="text-sm text-danger">{error}</p>}
      {board && (
        <WhiteboardCanvas
          whiteboardId={board.id}
          initialCanvas={board.canvasData}
          height={380}
        />
      )}
    </div>
  );
}
