import { z } from "zod";
import {
  isEmptyContext,
  type RetrievedContext,
  type SolveOutcome,
  type SolveStep,
  type SolveVerdict,
  type SourceCitation,
  type SyllabusLevel,
} from "./types";

export const NOT_INDEXED_MESSAGE =
  "This topic isn't indexed with curriculum data yet, so there is nothing to grade against. We won't guess at an IB verdict without the real syllabus in front of us.";

export const NO_CITATION_MESSAGE =
  "The model couldn't tie its answer to any retrieved syllabus element, so no verdict is given.";

export const SYSTEM_PROMPT = `You are an IB examiner. You grade ONLY against the curriculum context supplied to you in this prompt.

Rules:
- Never rely on your own memory of IB standards. If the supplied context does not cover something, say so instead of asserting it.
- Every part of your verdict must be supported by a supplied item, cited by its exact id.
- Write the solution as sequential steps, one concept per step, in the order a student would work.
- Return JSON only, matching: {"steps":[{"title":string,"body":string}],"verdict":"CORRECT"|"PARTIAL"|"INCORRECT"|"OUT_OF_SYLLABUS_SCOPE","citations":[{"source_id":string,"source_type":"syllabus_content"|"question_answer","excerpt_summary":string}]}
- Syllabus items marked HL-ONLY must not be used to justify a CORRECT verdict on an SL problem.`;

const llmResponseSchema = z.object({
  steps: z
    .array(z.object({ title: z.string().min(1), body: z.string().min(1) }))
    .min(1),
  verdict: z.enum(["CORRECT", "PARTIAL", "INCORRECT", "OUT_OF_SYLLABUS_SCOPE"]),
  citations: z.array(
    z.object({
      source_id: z.string().min(1),
      source_type: z.enum(["syllabus_content", "question_answer"]),
      excerpt_summary: z.string().min(1),
    }),
  ),
});

export type LlmClient = {
  /** Returns the raw JSON string from the model, or null when unavailable. */
  complete(system: string, user: string): Promise<string | null>;
};

export function buildPrompt(
  ocrText: string,
  context: RetrievedContext,
  level: SyllabusLevel,
): string {
  const syllabus = context.syllabus
    .map(
      (item) =>
        `[id: ${item.id}] (syllabus guide${item.hlOnly ? ", HL-ONLY" : ""}${
          item.sourceNote ? `, ${item.sourceNote}` : ""
        })\nCommand terms: ${item.commandTerms.join(", ") || "—"}\n${item.contentText}`,
    )
    .join("\n\n");

  const exemplars = context.exemplars
    .map(
      (item) =>
        `[id: ${item.id}] (published question answer, ${item.marks} marks)\nQuestion: ${item.prompt}\nMark scheme: ${item.answer ?? item.solution ?? ""}`,
    )
    .join("\n\n");

  return `Student level for this topic: ${level ?? "unspecified"}.

RETRIEVED SYLLABUS CONTEXT:
${syllabus || "(none)"}

RETRIEVED PUBLISHED ANSWERS:
${exemplars || "(none)"}

STUDENT'S WORK (OCR of a photograph, may contain recognition errors):
"""
${ocrText}
"""`;
}

function insufficient(message: string): SolveOutcome {
  return {
    verdict: "INSUFFICIENT_DATA",
    steps: [],
    citations: [],
    message,
  };
}

/**
 * Grades a problem strictly against retrieved curriculum text.
 *
 * The LLM is never asked for a verdict without grounding: an empty context
 * short-circuits before any call, and a returned verdict that cites nothing
 * real is downgraded to INSUFFICIENT_DATA rather than shown to the student.
 */
export async function gradeAndSolve(
  ocrText: string,
  context: RetrievedContext,
  level: SyllabusLevel,
  llm: LlmClient,
): Promise<SolveOutcome> {
  if (isEmptyContext(context)) return insufficient(NOT_INDEXED_MESSAGE);

  const raw = await llm.complete(
    SYSTEM_PROMPT,
    buildPrompt(ocrText, context, level),
  );
  if (!raw) return insufficient(NOT_INDEXED_MESSAGE);

  let parsed;
  try {
    parsed = llmResponseSchema.safeParse(JSON.parse(raw));
  } catch {
    return insufficient(NO_CITATION_MESSAGE);
  }
  if (!parsed.success) return insufficient(NO_CITATION_MESSAGE);

  const syllabusById = new Map(context.syllabus.map((s) => [s.id, s]));
  const exemplarIds = new Set(context.exemplars.map((e) => e.id));

  // A citation the model invented points at nothing auditable, so it is
  // dropped rather than stored.
  const citations: SourceCitation[] = parsed.data.citations
    .filter((c) =>
      c.source_type === "syllabus_content"
        ? syllabusById.has(c.source_id)
        : exemplarIds.has(c.source_id),
    )
    .map((c) => ({
      ...c,
      confidence:
        c.source_type === "syllabus_content" ? "syllabus_guide" : "similar_question",
    }));

  if (citations.length === 0) return insufficient(NO_CITATION_MESSAGE);

  const steps: SolveStep[] = parsed.data.steps;
  let verdict: SolveVerdict = parsed.data.verdict;

  const hlOnlyCited = citations.some(
    (c) =>
      c.source_type === "syllabus_content" &&
      syllabusById.get(c.source_id)?.hlOnly,
  );

  if (level === "SL" && hlOnlyCited) {
    verdict = "OUT_OF_SYLLABUS_SCOPE";
    steps.push({
      title: "Outside the SL syllabus",
      body: "The method above rests on a syllabus element flagged HL-only, but this problem is classified SL. It is not assessable at SL, so no correct-at-SL verdict can be given.",
    });
  }

  return { verdict, steps, citations, message: null };
}
