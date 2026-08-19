"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ConfidenceRating } from "@/lib/types";

export type NavState = "current" | "wrong" | "marked" | "unseen";

export function navState(
  index: number,
  currentIndex: number,
  confidence: ConfidenceRating | undefined,
): NavState {
  if (index === currentIndex) return "current";
  if (!confidence) return "unseen";
  return confidence === "wrong" ? "wrong" : "marked";
}

/** Columns track the paper length so short sessions don't render a sparse grid. */
export function navColumns(count: number) {
  if (count <= 4) return count || 1;
  if (count <= 12) return 4;
  if (count <= 30) return 5;
  return 6;
}

const STATE_CLASS: Record<NavState, string> = {
  current: "border-accent bg-accent font-semibold text-accent-foreground",
  wrong: "border-accent/40 bg-accent/15 text-accent",
  marked: "border-success/40 bg-success/15 text-success",
  unseen:
    "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
};

export function ExamNavPanel({
  count,
  currentIndex,
  outcomes,
  onSelect,
  className,
}: {
  count: number;
  currentIndex: number;
  outcomes: Record<number, ConfidenceRating>;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const columns = navColumns(count);

  return (
    <aside
      aria-label="Exam navigation panel"
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Exam navigation panel
      </p>
      <ol
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }, (_, i) => {
          const state = navState(i, currentIndex, outcomes[i]);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Go to question ${i + 1}`}
                aria-current={state === "current" ? "true" : undefined}
                className={cn(
                  "flex h-9 w-full items-center justify-center rounded-md border font-mono text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  STATE_CLASS[state],
                )}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {Object.keys(outcomes).length}/{count} marked
      </p>
    </aside>
  );
}
