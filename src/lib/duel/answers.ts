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
