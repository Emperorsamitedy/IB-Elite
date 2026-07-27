import { cn } from "@/lib/utils";

/**
 * A command-term stamp (DEFINE ▸, EVALUATE ▸ …) — IB questions open with a
 * command verb. Rendered in mono, examiner-red. `tone="solid"` fills it.
 */
export function CommandStamp({
  term,
  tone = "solid",
  arrow = true,
  className,
}: {
  term: string;
  tone?: "solid" | "outline";
  arrow?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] font-mono text-[11px] font-semibold uppercase tracking-[0.1em]",
        tone === "solid"
          ? "bg-accent px-2 py-0.5 text-accent-foreground"
          : "border border-accent px-2 py-0.5 text-accent",
        className,
      )}
    >
      {term}
      {arrow && <span aria-hidden>▸</span>}
    </span>
  );
}

const COMMAND_TERMS = [
  "define",
  "explain",
  "evaluate",
  "discuss",
  "analyse",
  "describe",
  "calculate",
  "state",
  "justify",
  "compare",
  "outline",
  "derive",
  "solve",
  "determine",
  "sketch",
  "prove",
];

/**
 * Best-effort command term for a question, inferred from its prompt/title.
 * Falls back to a difficulty-appropriate default.
 */
export function commandTermFor(text: string | null | undefined): string {
  if (text) {
    const first = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    if (first && COMMAND_TERMS.includes(first)) return first;
    const found = COMMAND_TERMS.find((t) => text.toLowerCase().includes(t));
    if (found) return found;
  }
  return "solve";
}
