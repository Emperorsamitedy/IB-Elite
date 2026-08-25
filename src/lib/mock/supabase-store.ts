import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type {
  EntryWithSitting,
  MockEntry,
  MockPaper,
  MockResultRow,
  MockScript,
  MockSitting,
  MockStore,
} from "./store";
import type { CriterionAward, EntryStatus, MockBand } from "./types";

const PAPER_COLUMNS =
  "id, subject_id, level_code, language, title, body, duration_minutes, markscheme, status";
const SITTING_COLUMNS =
  "id, paper_id, band, opens_at, closes_at, results_at, status";
const ENTRY_COLUMNS =
  "id, sitting_id, user_id, status, started_at, submitted_at, grading_started_at";
const RESULT_COLUMNS =
  "entry_id, total_awarded, total_max, criteria, grader, global_percentile, country_percentile, country_rank, released";

type AdminClient = ReturnType<typeof createAdminClient>;

function asPaper(row: Record<string, unknown>): MockPaper {
  return row as MockPaper;
}
function asSitting(row: Record<string, unknown>): MockSitting {
  return row as MockSitting;
}
function asEntry(row: Record<string, unknown>): MockEntry {
  return row as MockEntry;
}
function asResult(row: Record<string, unknown>): MockResultRow {
  const r = row as MockResultRow & { criteria: Json };
  return {
    ...r,
    criteria: (Array.isArray(r.criteria)
      ? r.criteria
      : []) as unknown as CriterionAward[],
  };
}

/** All writes go through the service role; students only ever read. */
export function createSupabaseMockStore(
  client: AdminClient = createAdminClient(),
): MockStore {
  return {
    async getPaper(id) {
      const { data } = await client
        .from("mock_papers")
        .select(PAPER_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      return data ? asPaper(data) : null;
    },

    async getSitting(id) {
      const { data } = await client
        .from("mock_sittings")
        .select(SITTING_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      return data ? asSitting(data) : null;
    },

    async listSittingsForPaper(paperId) {
      const { data } = await client
        .from("mock_sittings")
        .select(SITTING_COLUMNS)
        .eq("paper_id", paperId)
        .order("opens_at");
      return (data ?? []).map(asSitting);
    },

    async getEntry(sittingId, userId) {
      const { data } = await client
        .from("mock_entries")
        .select(ENTRY_COLUMNS)
        .eq("sitting_id", sittingId)
        .eq("user_id", userId)
        .maybeSingle();
      return data ? asEntry(data) : null;
    },

    async getEntryById(id) {
      const { data } = await client
        .from("mock_entries")
        .select(ENTRY_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      return data ? asEntry(data) : null;
    },

    async createEntry(sittingId, userId) {
      const { data, error } = await client
        .from("mock_entries")
        .insert({ sitting_id: sittingId, user_id: userId })
        .select(ENTRY_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asEntry(data);
    },

    async updateEntry(id, patch) {
      const { data, error } = await client
        .from("mock_entries")
        .update(patch)
        .eq("id", id)
        .select(ENTRY_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asEntry(data);
    },

    async listEntriesForPaper(paperId) {
      const { data } = await client
        .from("mock_entries")
        .select(`${ENTRY_COLUMNS}, mock_sittings!inner(paper_id, closes_at, band)`)
        .eq("mock_sittings.paper_id", paperId);
      return (data ?? []).map((row) => {
        const sitting = row.mock_sittings as unknown as {
          closes_at: string;
          band: MockBand;
        };
        return {
          ...asEntry(row as Record<string, unknown>),
          closes_at: sitting.closes_at,
          band: sitting.band,
        } as EntryWithSitting;
      });
    },

    async listStuckGrading(cutoffIso) {
      const { data } = await client
        .from("mock_entries")
        .select(ENTRY_COLUMNS)
        .eq("status", "grading")
        .lt("grading_started_at", cutoffIso);
      return (data ?? []).map(asEntry);
    },

    async claimEntries(batch) {
      const { data, error } = await client.rpc("claim_mock_entries", { batch });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map(asEntry);
    },

    async addScript(entryId, pageIndex, imagePath) {
      const { data, error } = await client
        .from("mock_scripts")
        .insert({ entry_id: entryId, page_index: pageIndex, image_path: imagePath })
        .select("id, entry_id, page_index, image_path, ocr_text")
        .single();
      if (error) throw new Error(error.message);
      return data as MockScript;
    },

    async listScripts(entryId) {
      const { data } = await client
        .from("mock_scripts")
        .select("id, entry_id, page_index, image_path, ocr_text")
        .eq("entry_id", entryId)
        .order("page_index");
      return (data ?? []) as MockScript[];
    },

    async setScriptOcr(scriptId, text) {
      await client.from("mock_scripts").update({ ocr_text: text }).eq("id", scriptId);
    },

    async upsertResult(row) {
      const { error } = await client.from("mock_results").upsert({
        ...row,
        criteria: row.criteria as unknown as Json,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },

    async getResult(entryId) {
      const { data } = await client
        .from("mock_results")
        .select(RESULT_COLUMNS)
        .eq("entry_id", entryId)
        .maybeSingle();
      return data ? asResult(data) : null;
    },

    async listResultsForEntries(entryIds) {
      if (entryIds.length === 0) return [];
      const { data } = await client
        .from("mock_results")
        .select(RESULT_COLUMNS)
        .in("entry_id", entryIds);
      return (data ?? []).map(asResult);
    },

    async getCountry(userId) {
      const { data } = await client
        .from("profiles")
        .select("country")
        .eq("id", userId)
        .maybeSingle();
      return data?.country ?? null;
    },

    async historyScoreShare(userId) {
      const { data } = await client
        .from("performance_events")
        .select("payload")
        .eq("user_id", userId)
        .eq("kind", "mock_result")
        .eq("quarantined", false)
        .order("created_at", { ascending: false })
        .limit(12);
      const rows = data ?? [];
      if (rows.length === 0) return null;
      const shares = rows.map((r) => {
        const payload = r.payload as { totalAwarded?: number; totalMax?: number };
        const max = payload.totalMax || 1;
        return (payload.totalAwarded ?? 0) / max;
      });
      return shares.reduce((a, b) => a + b, 0) / shares.length;
    },

    async appendEvents(events) {
      if (events.length === 0) return;
      const { error } = await client.from("performance_events").insert(
        events.map((e) => ({
          user_id: e.userId,
          subject_id: e.subjectId,
          kind: e.kind,
          payload: e.payload,
          quarantined: e.quarantined ?? false,
        })),
      );
      if (error) throw new Error(error.message);
    },

    async createIntegrityReview(input) {
      const { error } = await client.from("integrity_reviews").insert({
        user_id: input.userId,
        source_kind: "mock_entry",
        source_id: input.sourceId,
        reason: input.reason,
        details: input.details,
      });
      if (error) throw new Error(error.message);
    },

    async notify(input) {
      const { data: optout } = await client
        .from("notification_optouts")
        .select("category")
        .eq("user_id", input.userId)
        .eq("category", input.category)
        .maybeSingle();
      if (optout) return;
      await client.from("notifications").insert({
        user_id: input.userId,
        category: input.category,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      });
    },
  };
}

export type { EntryStatus };
