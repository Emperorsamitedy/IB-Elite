import type { Json } from "@/lib/supabase/database.types";
import type { CriterionAward, EntryStatus, MockBand } from "./types";

export type MockPaper = {
  id: string;
  subject_id: string;
  level_code: "SL" | "HL";
  language: string;
  title: string;
  body: string;
  duration_minutes: number;
  markscheme: Json;
  status: "draft" | "calibration" | "scheduled" | "cancelled";
};

export type MockSitting = {
  id: string;
  paper_id: string;
  band: MockBand;
  opens_at: string;
  closes_at: string;
  results_at: string;
  status: "scheduled" | "cancelled";
};

export type MockEntry = {
  id: string;
  sitting_id: string;
  user_id: string;
  status: EntryStatus;
  started_at: string | null;
  submitted_at: string | null;
};

export type MockScript = {
  id: string;
  entry_id: string;
  page_index: number;
  image_path: string;
  ocr_text: string | null;
};

export type MockResultRow = {
  entry_id: string;
  total_awarded: number;
  total_max: number;
  criteria: CriterionAward[];
  grader: "ai" | "keywords";
  global_percentile: number | null;
  country_percentile: number | null;
  country_rank: number | null;
  released: boolean;
};

/** Entry + the sitting facts needed to recompute lateness at release. */
export type EntryWithSitting = MockEntry & {
  closes_at: string;
  band: MockBand;
};

export type MockEventInput = {
  userId: string;
  subjectId: string | null;
  kind: "mock_result";
  payload: Record<string, Json>;
  quarantined?: boolean;
};

/** Storage seam; the Supabase implementation writes via the service role. */
export type MockStore = {
  getPaper(id: string): Promise<MockPaper | null>;
  getSitting(id: string): Promise<MockSitting | null>;
  listSittingsForPaper(paperId: string): Promise<MockSitting[]>;

  getEntry(sittingId: string, userId: string): Promise<MockEntry | null>;
  getEntryById(id: string): Promise<MockEntry | null>;
  createEntry(sittingId: string, userId: string): Promise<MockEntry>;
  updateEntry(
    id: string,
    patch: Partial<Pick<MockEntry, "status" | "started_at" | "submitted_at">>,
  ): Promise<MockEntry>;
  listEntriesForPaper(paperId: string): Promise<EntryWithSitting[]>;
  /** Atomically claims submitted/late entries for grading (SKIP LOCKED). */
  claimEntries(batch: number): Promise<MockEntry[]>;

  addScript(
    entryId: string,
    pageIndex: number,
    imagePath: string,
  ): Promise<MockScript>;
  listScripts(entryId: string): Promise<MockScript[]>;
  setScriptOcr(scriptId: string, text: string): Promise<void>;

  upsertResult(row: MockResultRow): Promise<void>;
  getResult(entryId: string): Promise<MockResultRow | null>;
  listResultsForEntries(entryIds: string[]): Promise<MockResultRow[]>;

  getCountry(userId: string): Promise<string | null>;
  /** Mean score share over the user's prior released mock results. */
  historyScoreShare(userId: string): Promise<number | null>;

  appendEvents(events: MockEventInput[]): Promise<void>;
  createIntegrityReview(input: {
    userId: string;
    sourceId: string;
    reason: string;
    details: Record<string, Json>;
  }): Promise<void>;
  notify(input: {
    userId: string;
    category: "mock";
    title: string;
    body?: string;
    href?: string;
  }): Promise<void>;
};
