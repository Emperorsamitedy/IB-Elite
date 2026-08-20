/**
 * What the student is currently looking at. Pages declare this so the
 * assistant opens already knowing the situation instead of asking.
 */
export type PageContext = {
  /** Human label for the screen, e.g. "Practice session". */
  page: string;
  path?: string;
  subject?: string | null;
  topic?: string | null;
  questionId?: string | null;
  /** Anything screen-specific, e.g. "Question 3 of 10 · 2 marked wrong". */
  detail?: string | null;
};

/** What the student has been struggling with, independent of the screen. */
export type StudyContext = {
  subjects: string[];
  weakTopics: string[];
  unresolvedMistakes: number;
};

export const DEFAULT_PAGE_CONTEXT: PageContext = { page: "Atlas" };

/** Chips shown in the panel header, so the grounding is visible to the student. */
export function contextChips(context: PageContext): string[] {
  return [context.page, context.subject, context.topic, context.detail].filter(
    (chip): chip is string => Boolean(chip),
  );
}

/** Quick actions worth offering depend on whether a question is in view. */
export function quickActions(context: PageContext): string[] {
  if (context.questionId) {
    return [
      "Give me a hint",
      "Explain the concept",
      "Show me the next step",
      "Check my method",
    ];
  }
  if (context.topic) {
    return [
      `Explain ${context.topic} simply`,
      `What does the IB expect on ${context.topic}?`,
      "Common mistakes here",
      "Quiz me",
    ];
  }
  return [
    "What should I revise next?",
    "Explain a concept",
    "Help me plan my week",
    "Go over my mistakes",
  ];
}

/**
 * The context block handed to the model. Kept pure so its wording is testable
 * and so it never silently drops the screen the student is on.
 */
export function buildAssistantContext(
  page: PageContext,
  study: StudyContext,
): string {
  const lines = [`The student is on: ${page.page}.`];
  if (page.path) lines.push(`Route: ${page.path}`);
  if (page.subject) lines.push(`Subject in view: ${page.subject}`);
  if (page.topic) lines.push(`Topic in view: ${page.topic}`);
  if (page.detail) lines.push(`Screen detail: ${page.detail}`);
  if (study.subjects.length > 0) {
    lines.push(`Their IB subjects: ${study.subjects.join(", ")}`);
  }
  if (study.weakTopics.length > 0) {
    lines.push(`Topics they keep getting wrong: ${study.weakTopics.join(", ")}`);
  }
  if (study.unresolvedMistakes > 0) {
    lines.push(
      `Unresolved mistakes in their notebook: ${study.unresolvedMistakes}`,
    );
  }
  return lines.join("\n");
}
