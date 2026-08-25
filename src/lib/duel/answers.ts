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
      return accept.some((candidate) => {
        if (typeof candidate !== "string") return false;
        if (normalise(candidate) === normalise(value)) return true;
        // "2.0", "2" and "2," must never disagree: when both sides parse
        // as numbers, compare the numbers, not the spelling.
        const target = Number(candidate.replace(/,/g, ""));
        const given = Number(value.replace(/,/g, ""));
        return (
          Number.isFinite(target) && Number.isFinite(given) && target === given
        );
      });
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

/**
 * Ranked pools favour formats that grade beyond dispute: MCQ and numeric
 * first, exact-match strings only to fill a short pool. A wrongly-marked
 * "wrong" costs rating, so brittle formats sit at the back of the queue.
 */
export function preferRobustPool<
  T extends { id: string; answer_type: string },
>(questions: T[], count: number, shuffle: (items: T[]) => T[]): string[] {
  const robust = questions.filter(
    (q) => q.answer_type === "mcq" || q.answer_type === "numeric",
  );
  const brittle = questions.filter(
    (q) => q.answer_type !== "mcq" && q.answer_type !== "numeric",
  );
  return [...shuffle(robust), ...shuffle(brittle)]
    .slice(0, count)
    .map((q) => q.id);
}
