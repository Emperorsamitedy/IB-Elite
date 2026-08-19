export type SolveVerdict =
  | "CORRECT"
  | "PARTIAL"
  | "INCORRECT"
  | "OUT_OF_SYLLABUS_SCOPE"
  | "INSUFFICIENT_DATA";

export type SyllabusLevel = "SL" | "HL" | null;

/** An original summary of the official syllabus, loaded by an admin. */
export type SyllabusItem = {
  id: string;
  topicId: string;
  subtopicId: string | null;
  contentText: string;
  commandTerms: string[];
  hlOnly: boolean;
  sourceNote: string | null;
};

/**
 * A published question's own answer on the same subtopic. Weaker grounding
 * than the syllabus guide, so it is retrieved and cited separately.
 */
export type ExemplarItem = {
  id: string;
  prompt: string;
  answer: string | null;
  solution: string | null;
  marks: number;
};

export type RetrievedContext = {
  syllabus: SyllabusItem[];
  exemplars: ExemplarItem[];
};

export function isEmptyContext(context: RetrievedContext): boolean {
  return context.syllabus.length === 0 && context.exemplars.length === 0;
}

/**
 * `syllabus_content` and `question_answer` are deliberately not merged: a
 * syllabus guide statement and another question's answer carry different
 * confidence, and the student is shown which one a verdict rests on.
 */
export type CitationSourceType = "syllabus_content" | "question_answer";

export type SourceCitation = {
  source_type: CitationSourceType;
  source_id: string;
  excerpt_summary: string;
  confidence: "syllabus_guide" | "similar_question";
};

export type SolveStep = { title: string; body: string };

export type SolveOutcome = {
  verdict: SolveVerdict;
  steps: SolveStep[];
  citations: SourceCitation[];
  /** Present when there is nothing to grade against. */
  message: string | null;
};

export type Classification = {
  subjectId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  confidence: number;
};

/** One row of the flattened subject → topic → subtopic tree. */
export type CatalogueEntry = {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  topicLevel: SyllabusLevel;
  subtopicId: string | null;
  subtopicName: string | null;
  subtopicLevel: SyllabusLevel;
};

export type SolveSession = {
  id: string;
  student_id: string;
  image_url: string;
  ocr_text: string | null;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  retrieved_context: RetrievedContext;
  steps: SolveStep[];
  verdict: SolveVerdict;
  source_citations: SourceCitation[];
  completed_at: string | null;
  created_at: string;
};
