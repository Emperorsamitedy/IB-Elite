import "server-only";
import { callGemini, isGeminiConfigured, parseJson } from "@/lib/scans/gemini";
import type { Criterion, CriterionAward, GradeOutcome } from "./types";

/** Grading seam so tests and calibration can swap the marker. */
export type MockGrader = {
  grade(transcript: string, criteria: Criterion[]): Promise<GradeOutcome>;
};

export function totalMax(criteria: Criterion[]): number {
  return criteria.reduce((sum, c) => sum + c.maxMarks, 0);
}

function clampAward(value: unknown, max: number): number {
  const n = typeof value === "number" ? Math.round(value) : 0;
  return Math.min(Math.max(0, n), max);
}

const MARKING_PROMPT = (criteria: Criterion[]) => `You are an experienced IB examiner marking a scanned, transcribed handwritten script against a markscheme.

Markscheme criteria (JSON): ${JSON.stringify(
  criteria.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    maxMarks: c.maxMarks,
  })),
)}

Return JSON only, shaped exactly:
{"criteria":[{"criterionId":"<id>","awarded":<integer 0..maxMarks>,"comment":"<one short examiner sentence>"}]}

Rules:
- Mark positively: award what the evidence in the script earns, nothing more.
- Award 0 for a criterion with no relevant evidence.
- Every criterion from the markscheme must appear exactly once.
- Keep comments specific to this script.`;

/** Examiner-style marking through Gemini. */
export function createGeminiMockGrader(): MockGrader {
  return {
    async grade(transcript, criteria) {
      const raw = await callGemini([
        { text: MARKING_PROMPT(criteria) },
        { text: `Student transcript:\n${transcript}` },
      ]);
      const parsed = parseJson<{
        criteria?: { criterionId?: string; awarded?: number; comment?: string }[];
      }>(raw);
      const byId = new Map(
        (parsed.criteria ?? []).map((c) => [c.criterionId, c]),
      );
      const awards: CriterionAward[] = criteria.map((c) => {
        const got = byId.get(c.id);
        return {
          criterionId: c.id,
          title: c.title,
          maxMarks: c.maxMarks,
          awarded: clampAward(got?.awarded, c.maxMarks),
          comment: got?.comment?.slice(0, 400) ?? null,
        };
      });
      return {
        criteria: awards,
        totalAwarded: awards.reduce((sum, a) => sum + a.awarded, 0),
        totalMax: totalMax(criteria),
        grader: "ai",
      };
    },
  };
}

const STOPWORDS = new Set([
  "the", "and", "with", "that", "this", "for", "from", "into", "onto",
  "are", "was", "has", "have", "how", "why", "each", "must", "should",
]);

function keywordsOf(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9%]+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
    ),
  ];
}

/**
 * Deterministic fallback when no AI key is configured: proportional credit
 * for criterion keywords found in the transcript. Labelled `keywords` so
 * the UI never dresses it up as examiner marking.
 */
export function createKeywordMockGrader(): MockGrader {
  return {
    async grade(transcript, criteria) {
      const haystack = transcript.toLowerCase();
      const awards: CriterionAward[] = criteria.map((c) => {
        const words = keywordsOf(`${c.title} ${c.description}`);
        const hits = words.filter((w) => haystack.includes(w));
        const share = words.length === 0 ? 0 : hits.length / words.length;
        return {
          criterionId: c.id,
          title: c.title,
          maxMarks: c.maxMarks,
          awarded: clampAward(Math.round(share * c.maxMarks), c.maxMarks),
          comment: null,
        };
      });
      return {
        criteria: awards,
        totalAwarded: awards.reduce((sum, a) => sum + a.awarded, 0),
        totalMax: totalMax(criteria),
        grader: "keywords",
      };
    },
  };
}

export function createMockGrader(): MockGrader {
  return isGeminiConfigured()
    ? createGeminiMockGrader()
    : createKeywordMockGrader();
}
