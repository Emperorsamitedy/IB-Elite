import { describe, expect, it, vi } from "vitest";
import { classifyProblem, effectiveLevel } from "./classify";
import { retrieveContext, type RetrievalSource } from "./retrieve";
import {
  gradeAndSolve,
  NOT_INDEXED_MESSAGE,
  type LlmClient,
} from "./grade";
import { checkSolveUsage, FREE_SOLVES_PER_DAY } from "./usage";
import type {
  CatalogueEntry,
  ExemplarItem,
  RetrievedContext,
  SyllabusItem,
} from "./types";

const syllabusItem = (over: Partial<SyllabusItem> = {}): SyllabusItem => ({
  id: "syl-1",
  topicId: "topic-1",
  subtopicId: "sub-1",
  contentText: "Solve exponential equations by taking logarithms of both sides.",
  commandTerms: ["Solve", "Evaluate"],
  hlOnly: false,
  sourceNote: "IB Math AA syllabus guide, 2027 first exams",
  ...over,
});

const exemplar = (over: Partial<ExemplarItem> = {}): ExemplarItem => ({
  id: "q-1",
  prompt: "Evaluate log_3(81).",
  answer: "4",
  solution: null,
  marks: 2,
  ...over,
});

const source = (
  syllabus: SyllabusItem[],
  exemplars: ExemplarItem[],
): RetrievalSource => ({
  syllabusFor: async () => syllabus,
  exemplarsFor: async () => exemplars,
});

function llmReturning(payload: unknown): LlmClient {
  return { complete: vi.fn(async () => JSON.stringify(payload)) };
}

describe("classifyProblem", () => {
  const catalogue: CatalogueEntry[] = [
    {
      subjectId: "subj-1",
      subjectName: "Mathematics: Analysis & Approaches",
      topicId: "topic-1",
      topicName: "Exponents & Logarithms",
      topicLevel: "SL",
      subtopicId: "sub-1",
      subtopicName: "Laws of logarithms",
      subtopicLevel: null,
    },
  ];

  it("matches a problem to its subtopic", () => {
    const match = classifyProblem(
      "Use the laws of logarithms to simplify log 8 + log 2",
      catalogue,
    );
    expect(match.subtopicId).toBe("sub-1");
    expect(match.topicId).toBe("topic-1");
  });

  it("returns null fields rather than guessing", () => {
    const match = classifyProblem("Describe osmosis in plant cells", catalogue);
    expect(match).toMatchObject({
      subjectId: null,
      topicId: null,
      subtopicId: null,
    });
  });
});

describe("effectiveLevel", () => {
  it("prefers the subtopic level and falls back to the topic", () => {
    expect(effectiveLevel("SL", "HL")).toBe("HL");
    expect(effectiveLevel("SL", null)).toBe("SL");
  });
});

describe("retrieveContext", () => {
  it("returns an empty result when nothing matches", async () => {
    const context = await retrieveContext("topic-1", "sub-1", source([], []));
    expect(context).toEqual({ syllabus: [], exemplars: [] });
  });

  it("drops exemplars with no answer or solution", async () => {
    const context = await retrieveContext(
      "topic-1",
      "sub-1",
      source([], [exemplar({ answer: null, solution: null })]),
    );
    expect(context.exemplars).toHaveLength(0);
  });

  it("keeps syllabus and question sources in separate buckets", async () => {
    const context = await retrieveContext(
      "topic-1",
      "sub-1",
      source([syllabusItem()], [exemplar()]),
    );
    expect(context.syllabus).toHaveLength(1);
    expect(context.exemplars).toHaveLength(1);
  });
});

describe("gradeAndSolve", () => {
  it("returns INSUFFICIENT_DATA without calling the LLM when nothing was retrieved", async () => {
    const llm: LlmClient = { complete: vi.fn() };
    const empty: RetrievedContext = { syllabus: [], exemplars: [] };

    const outcome = await gradeAndSolve("log_3(81)", empty, "SL", llm);

    expect(outcome.verdict).toBe("INSUFFICIENT_DATA");
    expect(outcome.message).toBe(NOT_INDEXED_MESSAGE);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("requires at least one real citation", async () => {
    const context: RetrievedContext = {
      syllabus: [syllabusItem()],
      exemplars: [],
    };
    const outcome = await gradeAndSolve(
      "log_3(81) = 4",
      context,
      "SL",
      llmReturning({
        steps: [{ title: "Rewrite", body: "3^4 = 81" }],
        verdict: "CORRECT",
        citations: [
          {
            source_id: "syl-1",
            source_type: "syllabus_content",
            excerpt_summary: "Laws of logarithms",
          },
        ],
      }),
    );

    expect(outcome.verdict).toBe("CORRECT");
    expect(outcome.citations).toHaveLength(1);
    expect(outcome.citations[0].confidence).toBe("syllabus_guide");
  });

  it("downgrades an uncited verdict to INSUFFICIENT_DATA", async () => {
    const context: RetrievedContext = {
      syllabus: [syllabusItem()],
      exemplars: [],
    };
    const outcome = await gradeAndSolve(
      "log_3(81) = 4",
      context,
      "SL",
      llmReturning({
        steps: [{ title: "Rewrite", body: "3^4 = 81" }],
        verdict: "CORRECT",
        citations: [],
      }),
    );

    expect(outcome.verdict).toBe("INSUFFICIENT_DATA");
    expect(outcome.citations).toHaveLength(0);
  });

  it("discards citations pointing at items that were never retrieved", async () => {
    const context: RetrievedContext = {
      syllabus: [syllabusItem()],
      exemplars: [],
    };
    const outcome = await gradeAndSolve(
      "log_3(81) = 4",
      context,
      "SL",
      llmReturning({
        steps: [{ title: "Rewrite", body: "3^4 = 81" }],
        verdict: "CORRECT",
        citations: [
          {
            source_id: "invented-id",
            source_type: "syllabus_content",
            excerpt_summary: "Something the model made up",
          },
        ],
      }),
    );

    expect(outcome.verdict).toBe("INSUFFICIENT_DATA");
  });

  it("labels a published answer citation as the weaker source", async () => {
    const context: RetrievedContext = {
      syllabus: [],
      exemplars: [exemplar()],
    };
    const outcome = await gradeAndSolve(
      "log_3(81) = 4",
      context,
      "SL",
      llmReturning({
        steps: [{ title: "Compare", body: "Matches the published answer" }],
        verdict: "CORRECT",
        citations: [
          {
            source_id: "q-1",
            source_type: "question_answer",
            excerpt_summary: "Published answer: 4",
          },
        ],
      }),
    );

    expect(outcome.citations[0].confidence).toBe("similar_question");
  });

  it("returns OUT_OF_SYLLABUS_SCOPE when an HL-only element grounds an SL problem", async () => {
    const context: RetrievedContext = {
      syllabus: [syllabusItem({ id: "syl-hl", hlOnly: true })],
      exemplars: [],
    };
    const outcome = await gradeAndSolve(
      "Integrate by parts",
      context,
      "SL",
      llmReturning({
        steps: [{ title: "Apply integration by parts", body: "uv - ∫v du" }],
        verdict: "CORRECT",
        citations: [
          {
            source_id: "syl-hl",
            source_type: "syllabus_content",
            excerpt_summary: "Integration by parts (HL only)",
          },
        ],
      }),
    );

    expect(outcome.verdict).toBe("OUT_OF_SYLLABUS_SCOPE");
    expect(outcome.steps.at(-1)?.title).toBe("Outside the SL syllabus");
  });

  it("allows the same HL element on an HL problem", async () => {
    const context: RetrievedContext = {
      syllabus: [syllabusItem({ id: "syl-hl", hlOnly: true })],
      exemplars: [],
    };
    const outcome = await gradeAndSolve(
      "Integrate by parts",
      context,
      "HL",
      llmReturning({
        steps: [{ title: "Apply integration by parts", body: "uv - ∫v du" }],
        verdict: "CORRECT",
        citations: [
          {
            source_id: "syl-hl",
            source_type: "syllabus_content",
            excerpt_summary: "Integration by parts",
          },
        ],
      }),
    );

    expect(outcome.verdict).toBe("CORRECT");
  });

  it("falls back to INSUFFICIENT_DATA when the LLM is unavailable", async () => {
    const outcome = await gradeAndSolve(
      "log_3(81)",
      { syllabus: [syllabusItem()], exemplars: [] },
      "SL",
      { complete: async () => null },
    );
    expect(outcome.verdict).toBe("INSUFFICIENT_DATA");
  });
});

describe("checkSolveUsage", () => {
  it("blocks a free student at the daily limit with an upgrade message", () => {
    const decision = checkSolveUsage(false, FREE_SOLVES_PER_DAY);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.message).toMatch(/Upgrade to Pro/);
  });

  it("allows a free student below the limit", () => {
    const decision = checkSolveUsage(false, FREE_SOLVES_PER_DAY - 1);
    expect(decision).toEqual({ allowed: true, remaining: 0 });
  });

  it("never limits a pro student", () => {
    expect(checkSolveUsage(true, 500)).toEqual({
      allowed: true,
      remaining: null,
    });
  });
});
