import "server-only";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { serverEnv, featureFlags } from "@/lib/env";
import type { LlmClient } from "./grade";
import type { RetrievalSource } from "./retrieve";
import type {
  CatalogueEntry,
  ExemplarItem,
  SolveOutcome,
  SolveSession,
  SyllabusItem,
  SyllabusLevel,
} from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SolveSessionUpdate =
  Database["public"]["Tables"]["curriculum_solve_sessions"]["Update"];

const SESSION_COLUMNS =
  "id, student_id, image_url, ocr_text, subject_id, topic_id, subtopic_id, retrieved_context, steps, verdict, source_citations, completed_at, created_at";

/** Only questions on the same subtopic are close enough to ground a verdict. */
const MAX_EXEMPLARS = 3;

export function createRetrievalSource(
  client: AdminClient = createAdminClient(),
): RetrievalSource {
  return {
    async syllabusFor(topicId, subtopicId) {
      const query = client
        .from("syllabus_content")
        .select("id, topic_id, subtopic_id, content_text, command_terms, hl_only, source_note")
        .eq("topic_id", topicId);

      // A subtopic-specific row is preferred, but topic-wide rows (null
      // subtopic) also apply to every subtopic beneath them.
      const { data } = subtopicId
        ? await query.or(`subtopic_id.eq.${subtopicId},subtopic_id.is.null`)
        : await query.is("subtopic_id", null);

      return (data ?? []).map(
        (row): SyllabusItem => ({
          id: row.id,
          topicId: row.topic_id,
          subtopicId: row.subtopic_id,
          contentText: row.content_text,
          commandTerms: Array.isArray(row.command_terms)
            ? (row.command_terms as string[])
            : [],
          hlOnly: Boolean(row.hl_only),
          sourceNote: row.source_note,
        }),
      );
    },

    async exemplarsFor(topicId, subtopicId) {
      const query = client
        .from("questions")
        .select("id, prompt, answer, solution, marks")
        .eq("status", "published")
        .limit(MAX_EXEMPLARS);

      const { data } = subtopicId
        ? await query.eq("subtopic_id", subtopicId)
        : await query.eq("topic_id", topicId);

      return (data ?? []).map(
        (row): ExemplarItem => ({
          id: row.id,
          prompt: row.prompt,
          answer: row.answer,
          solution: row.solution,
          marks: row.marks,
        }),
      );
    },
  };
}

export async function loadCatalogue(
  client: AdminClient = createAdminClient(),
): Promise<CatalogueEntry[]> {
  const { data } = await client
    .from("topics")
    .select(
      "id, name, level_code, subject_id, subjects(name), subtopics(id, name, level_code)",
    );

  const entries: CatalogueEntry[] = [];
  for (const topic of data ?? []) {
    const subject = (topic.subjects as { name: string } | null)?.name ?? "";
    const subtopics =
      (topic.subtopics as { id: string; name: string; level_code: string | null }[]) ??
      [];
    const base = {
      subjectId: topic.subject_id,
      subjectName: subject,
      topicId: topic.id,
      topicName: topic.name,
      topicLevel: (topic.level_code as SyllabusLevel) ?? null,
    };

    if (subtopics.length === 0) {
      entries.push({ ...base, subtopicId: null, subtopicName: null, subtopicLevel: null });
      continue;
    }
    for (const sub of subtopics) {
      entries.push({
        ...base,
        subtopicId: sub.id,
        subtopicName: sub.name,
        subtopicLevel: (sub.level_code as SyllabusLevel) ?? null,
      });
    }
  }
  return entries;
}

export type SolveStore = {
  usageToday(studentId: string): Promise<number>;
  recordUsage(studentId: string): Promise<void>;
  createSession(input: {
    studentId: string;
    imageUrl: string;
  }): Promise<SolveSession>;
  saveResult(sessionId: string, patch: SolveSessionUpdate): Promise<SolveSession>;
  getSession(sessionId: string): Promise<SolveSession | null>;
  complete(sessionId: string): Promise<SolveSession>;
};

function asSession(row: Record<string, unknown>): SolveSession {
  return row as unknown as SolveSession;
}

export function createSolveStore(
  client: AdminClient = createAdminClient(),
): SolveStore {
  const today = () => new Date().toISOString().slice(0, 10);

  return {
    async usageToday(studentId) {
      const { data } = await client
        .from("curriculum_solve_usage")
        .select("count")
        .eq("student_id", studentId)
        .eq("usage_date", today())
        .maybeSingle();
      return data?.count ?? 0;
    },

    async recordUsage(studentId) {
      const current = await this.usageToday(studentId);
      await client
        .from("curriculum_solve_usage")
        .upsert(
          { student_id: studentId, usage_date: today(), count: current + 1 },
          { onConflict: "student_id,usage_date" },
        );
    },

    async createSession({ studentId, imageUrl }) {
      const { data, error } = await client
        .from("curriculum_solve_sessions")
        .insert({ student_id: studentId, image_url: imageUrl })
        .select(SESSION_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asSession(data);
    },

    async saveResult(sessionId, patch) {
      const { data, error } = await client
        .from("curriculum_solve_sessions")
        .update(patch)
        .eq("id", sessionId)
        .select(SESSION_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asSession(data);
    },

    async getSession(sessionId) {
      const { data } = await client
        .from("curriculum_solve_sessions")
        .select(SESSION_COLUMNS)
        .eq("id", sessionId)
        .maybeSingle();
      return data ? asSession(data) : null;
    },

    async complete(sessionId) {
      const { data, error } = await client
        .from("curriculum_solve_sessions")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", sessionId)
        .select(SESSION_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asSession(data);
    },
  };
}

/** Cheapest capable tier; grading is grounded by retrieval, not model size. */
export const SOLVE_MODEL_FALLBACK = "gpt-4o-mini";

export function createOpenAiSolveClient(): LlmClient {
  return {
    async complete(system, user) {
      if (!featureFlags.ai || !serverEnv.openaiApiKey) return null;
      const client = new OpenAI({ apiKey: serverEnv.openaiApiKey });
      const completion = await client.chat.completions.create({
        model: serverEnv.openaiModel || SOLVE_MODEL_FALLBACK,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return completion.choices[0]?.message?.content ?? null;
    },
  };
}

export function outcomePatch(outcome: SolveOutcome): SolveSessionUpdate {
  return {
    // The columns are jsonb; the shapes are validated before they get here.
    steps: outcome.steps as unknown as Json,
    verdict: outcome.verdict,
    source_citations: outcome.citations as unknown as Json,
  };
}
