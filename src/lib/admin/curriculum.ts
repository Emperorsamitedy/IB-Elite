import { z } from "zod";

export const CURRICULUM_LEVELS = [
  "subjects",
  "themes",
  "topics",
  "subtopics",
] as const;
export type CurriculumLevel = (typeof CURRICULUM_LEVELS)[number];

/** Levels whose deletion cascades into questions, so it must be blocked. */
export const DESTRUCTIVE_LEVELS: CurriculumLevel[] = ["subjects", "topics"];

export const subjectSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  group_name: z.string().min(1).max(80).optional(),
  description: z.string().nullable().optional(),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const themeSchema = z.object({
  subject_id: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().nullable().optional(),
  level_code: z.enum(["SL", "HL"]).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const topicSchema = z.object({
  subject_id: z.string().uuid(),
  theme_id: z.string().uuid().nullable().optional(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const subtopicSchema = z.object({
  topic_id: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const SCHEMAS = {
  subjects: subjectSchema,
  themes: themeSchema,
  topics: topicSchema,
  subtopics: subtopicSchema,
} satisfies Record<CurriculumLevel, z.ZodObject<z.ZodRawShape>>;

export const reorderSchema = z.object({
  level: z.enum(CURRICULUM_LEVELS),
  ids: z.array(z.string().uuid()).min(1),
});

export type DeleteOutcome =
  | { status: "deleted" }
  | { status: "blocked"; affected: number }
  | { status: "error"; message: string };

/**
 * Deleting a subject or topic cascades into its questions, so the count is
 * checked first and the delete only proceeds once the admin forces it.
 * Themes and subtopics never destroy a question — their references are
 * `on delete set null` — so they delete straight away.
 */
export async function deleteCurriculumNode(
  level: CurriculumLevel,
  id: string,
  force: boolean,
  deps: {
    countQuestions(level: CurriculumLevel, id: string): Promise<number>;
    remove(level: CurriculumLevel, id: string): Promise<{ error?: string }>;
  },
): Promise<DeleteOutcome> {
  if (DESTRUCTIVE_LEVELS.includes(level) && !force) {
    const affected = await deps.countQuestions(level, id);
    if (affected > 0) return { status: "blocked", affected };
  }

  const { error } = await deps.remove(level, id);
  if (error) return { status: "error", message: error };
  return { status: "deleted" };
}

/** Writes sort_order = array index, so a re-fetch returns the same order. */
export async function persistOrder(
  level: CurriculumLevel,
  ids: string[],
  setOrder: (
    level: CurriculumLevel,
    id: string,
    sortOrder: number,
  ) => Promise<{ error?: string }>,
): Promise<{ error?: string }> {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await setOrder(level, ids[i], i);
    if (error) return { error };
  }
  return {};
}
