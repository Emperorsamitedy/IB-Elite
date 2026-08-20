import type { ExemplarItem, RetrievedContext, SyllabusItem } from "./types";

export type RetrievalSource = {
  syllabusFor(
    topicId: string,
    subtopicId: string | null,
  ): Promise<SyllabusItem[]>;
  exemplarsFor(
    topicId: string,
    subtopicId: string | null,
  ): Promise<ExemplarItem[]>;
};

export const EMPTY_CONTEXT: RetrievedContext = { syllabus: [], exemplars: [] };

/**
 * Pulls the grounding for a classified problem. An empty result is expected
 * and valid — most of the tree has no syllabus content loaded yet — so this
 * never throws for "nothing found"; the caller turns that into
 * INSUFFICIENT_DATA rather than an ungrounded verdict.
 */
export async function retrieveContext(
  topicId: string | null,
  subtopicId: string | null,
  source: RetrievalSource,
): Promise<RetrievedContext> {
  if (!topicId) return EMPTY_CONTEXT;

  const [syllabus, exemplars] = await Promise.all([
    source.syllabusFor(topicId, subtopicId),
    source.exemplarsFor(topicId, subtopicId),
  ]);

  return {
    syllabus,
    // A question with neither answer nor solution grounds nothing.
    exemplars: exemplars.filter((e) => e.answer?.trim() || e.solution?.trim()),
  };
}
