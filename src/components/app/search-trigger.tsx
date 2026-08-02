"use client";

import { Search } from "lucide-react";

export function SearchTrigger() {
  return (
    <button
      onClick={() =>
        window.dispatchEvent(new CustomEvent("open-command-palette"))
      }
      className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2 sm:w-64"
    >
      <Search className="h-4 w-4" />
      <span className="hidden flex-1 text-left sm:inline">Search…</span>
      <kbd className="hidden items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 font-mono text-2xs sm:flex">
        ⌘K
      </kbd>
    </button>
  );
}
