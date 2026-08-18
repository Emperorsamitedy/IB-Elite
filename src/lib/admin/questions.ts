import { z } from "zod";

export const COMMAND_TERMS = [
  "State",
  "Describe",
  "Explain",
  "Outline",
  "Calculate",
  "Determine",
  "Discuss",
  "Evaluate",
  "Analyse",
  "Compare",
  "Justify",
  "Suggest",
] as const;

export const questionInputSchema = z.object({
  subject_id: z.string().uuid(),
  topic_id: z.string().uuid(),
  subtopic_id: z.string().uuid().nullable().optional(),
  level_id: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  prompt: z.string().min(3),
  answer: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  command_term: z.string().max(60).nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  marks: z.coerce.number().int().min(0).max(100).default(1),
  question_type: z.string().min(1).default("short-answer"),
  calculator: z.boolean().nullable().optional(),
  year: z.coerce.number().int().nullable().optional(),
  paper: z.string().nullable().optional(),
  question_number: z.string().max(40).nullable().optional(),
  source: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  estimated_minutes: z.coerce.number().int().min(1).max(240).nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

export type ImportFailure = { row: number; reason: string };
export type ImportResult = {
  inserted: number;
  failed: number;
  failures: ImportFailure[];
};

/**
 * Row-level importer: every row is validated and inserted on its own, so a
 * single bad row can never fail the batch.
 */
export async function importQuestionRows(
  rows: unknown[],
  deps: {
    subjectExists(id: string): Promise<boolean>;
    topicExists(id: string, subjectId: string): Promise<boolean>;
    insert(row: QuestionInput): Promise<{ error?: string }>;
  },
): Promise<ImportResult> {
  const failures: ImportFailure[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const parsed = questionInputSchema.safeParse(rows[i]);
    if (!parsed.success) {
      failures.push({ row: i + 1, reason: describeIssues(parsed.error) });
      continue;
    }
    const value = parsed.data;

    if (!(await deps.subjectExists(value.subject_id))) {
      failures.push({
        row: i + 1,
        reason: `Subject ${value.subject_id} does not exist.`,
      });
      continue;
    }
    if (!(await deps.topicExists(value.topic_id, value.subject_id))) {
      failures.push({
        row: i + 1,
        reason: `Topic ${value.topic_id} does not exist on that subject.`,
      });
      continue;
    }

    const { error } = await deps.insert(value);
    if (error) {
      failures.push({ row: i + 1, reason: error });
      continue;
    }
    inserted++;
  }

  return { inserted, failed: failures.length, failures };
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
    .join("; ");
}

/** Parses a CSV export into raw objects keyed by header. Client-side helper. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitCsvRows(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const out: Record<string, string> = {};
    headers.forEach((h, i) => {
      out[h] = (cells[i] ?? "").trim();
    });
    return out;
  });
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
