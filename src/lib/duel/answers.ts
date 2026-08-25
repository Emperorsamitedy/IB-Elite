import type { Json } from "@/lib/supabase/database.types";

export type AnswerType = "free" | "mcq" | "numeric" | "exact";

/**
 * Server-side grading of a structured answer. Ranked duels only draw from
 * questions whose key grades deterministically; anything unparseable marks
 * wrong rather than throwing, so a malformed key can never 500 a match.
 */
export function gradeAnswer(
  answerType: AnswerType,
  answerKey: Json | null,
  submitted: string,
): boolean {
  const key = (answerKey ?? null) as Record<string, unknown> | null;
  if (!key || typeof key !== "object") return false;
  const value = submitted.trim();
  if (!value) return false;

  switch (answerType) {
    case "mcq": {
      const correct = key.correct;
      const chosen = Number.parseInt(value, 10);
      return Number.isInteger(correct) && chosen === correct;
    }
    case "numeric": {
      const target = Number(key.value);
      const tolerance = Number(key.tolerance ?? 0);
      const parsed = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(target) || !Number.isFinite(parsed)) return false;
      return Math.abs(parsed - target) <= Math.max(tolerance, 0);
    }
    case "exact": {
      const accept = Array.isArray(key.accept) ? key.accept : [];
      return accept.some(
        (candidate) =>
          typeof candidate === "string" &&
          normalise(candidate) === normalise(value),
      );
    }
    default:
      return false;
  }
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/**
 * Human-readable model answer for the post-match review. Only ever shown
 * once the match is COMPLETE — the same information the public question
 * bank already displays.
 */
export function modelAnswerOf(
  answerType: AnswerType,
  answerKey: Json | null,
): string | null {
  const key = (answerKey ?? null) as Record<string, unknown> | null;
  if (!key) return null;
  switch (answerType) {
    case "mcq": {
      const options = key.options;
      const correct = key.correct;
      return Array.isArray(options) && Number.isInteger(correct)
        ? String(options[correct as number] ?? "")
        : null;
    }
    case "numeric":
      return key.value !== undefined ? String(key.value) : null;
    case "exact": {
      const accept = key.accept;
      return Array.isArray(accept) && accept.length > 0
        ? String(accept[0])
        : null;
    }
    default:
      return null;
  }
}

/** Whether a question can back a server-graded (ranked or friendly) duel. */
export function isDuelGradable(
  answerType: string | null,
  answerKey: Json | null,
): boolean {
  return (
    answerType !== null &&
    answerType !== "free" &&
    answerKey !== null &&
    typeof answerKey === "object"
  );
}
