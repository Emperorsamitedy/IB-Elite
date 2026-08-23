import type { CatalogueEntry, Classification, SyllabusLevel } from "./types";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "for", "with",
  "that", "this", "as", "by", "on", "at", "it", "be", "from", "find", "show",
  "give", "using", "use", "your", "answer", "question", "marks",
]);

/** Confidence below this leaves every field null rather than forcing a guess. */
export const CLASSIFY_THRESHOLD = 0.5;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function overlap(needle: string, haystack: Set<string>): number {
  const words = tokenize(needle);
  if (words.length === 0) return 0;
  const hits = words.filter((word) => haystack.has(word)).length;
  return hits / words.length;
}

const NO_MATCH: Classification = {
  subjectId: null,
  topicId: null,
  subtopicId: null,
  confidence: 0,
};

/**
 * Matches OCR text to the curriculum by name overlap. A subtopic name is the
 * strongest signal, so it is weighted above the topic and subject; when the
 * best candidate is still weak every field stays null and the caller treats
 * the problem as unclassified rather than grading it against the wrong topic.
 */
export function classifyProblem(
  ocrText: string,
  catalogue: CatalogueEntry[],
): Classification {
  const words = new Set(tokenize(ocrText));
  if (words.size === 0 || catalogue.length === 0) return NO_MATCH;

  let best: { entry: CatalogueEntry; score: number } | null = null;

  for (const entry of catalogue) {
    const subtopic = entry.subtopicName ? overlap(entry.subtopicName, words) : 0;
    const topic = overlap(entry.topicName, words);
    const subject = overlap(entry.subjectName, words);
    const score = subtopic * 0.6 + topic * 0.3 + subject * 0.1;
    if (!best || score > best.score) best = { entry, score };
  }

  if (!best || best.score < CLASSIFY_THRESHOLD) return NO_MATCH;

  return {
    subjectId: best.entry.subjectId,
    topicId: best.entry.topicId,
    subtopicId: best.entry.subtopicId,
    confidence: Number(best.score.toFixed(3)),
  };
}

/** Subtopics may be HL inside an SL topic; null inherits the topic's level. */
export function effectiveLevel(
  topicLevel: SyllabusLevel,
  subtopicLevel: SyllabusLevel,
): SyllabusLevel {
  return subtopicLevel ?? topicLevel;
}
