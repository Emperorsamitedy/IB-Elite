import type {
  EntryWithSitting,
  MockEntry,
  MockEventInput,
  MockPaper,
  MockResultRow,
  MockScript,
  MockSitting,
  MockStore,
} from "./store";

/** In-memory mock store for tests; the caller injects the clock via service args. */
export function createFakeMockStore(seed: {
  papers: MockPaper[];
  sittings: MockSitting[];
  countries?: Record<string, string>;
}): MockStore & {
  entries: MockEntry[];
  scripts: MockScript[];
  results: MockResultRow[];
  events: MockEventInput[];
  reviews: { userId: string; sourceId: string; reason: string }[];
  notifications: { userId: string; title: string }[];
} {
  const entries: MockEntry[] = [];
  const scripts: MockScript[] = [];
  const results: MockResultRow[] = [];
  const events: MockEventInput[] = [];
  const reviews: { userId: string; sourceId: string; reason: string }[] = [];
  const notifications: { userId: string; title: string }[] = [];
  let counter = 0;
  const nextId = () => `id-${++counter}`;

  const store: MockStore = {
    async getPaper(id) {
      return seed.papers.find((p) => p.id === id) ?? null;
    },
    async getSitting(id) {
      return seed.sittings.find((s) => s.id === id) ?? null;
    },
    async listSittingsForPaper(paperId) {
      return seed.sittings.filter((s) => s.paper_id === paperId);
    },
    async getEntry(sittingId, userId) {
      return (
        entries.find(
          (e) => e.sitting_id === sittingId && e.user_id === userId,
        ) ?? null
      );
    },
    async getEntryById(id) {
      return entries.find((e) => e.id === id) ?? null;
    },
    async createEntry(sittingId, userId) {
      const entry: MockEntry = {
        id: nextId(),
        sitting_id: sittingId,
        user_id: userId,
        status: "entered",
        started_at: null,
        submitted_at: null,
        grading_started_at: null,
      };
      entries.push(entry);
      return entry;
    },
    async updateEntry(id, patch) {
      const entry = entries.find((e) => e.id === id);
      if (!entry) throw new Error("entry not found");
      Object.assign(entry, patch);
      return entry;
    },
    async listEntriesForPaper(paperId) {
      const out: EntryWithSitting[] = [];
      for (const entry of entries) {
        const sitting = seed.sittings.find((s) => s.id === entry.sitting_id);
        if (sitting?.paper_id === paperId) {
          out.push({ ...entry, closes_at: sitting.closes_at, band: sitting.band });
        }
      }
      return out;
    },
    async claimEntries(batch) {
      const ready = entries.filter((e) =>
        ["submitted", "late"].includes(e.status),
      );
      const claimed = ready.slice(0, batch);
      for (const entry of claimed) {
        entry.status = "grading";
        entry.grading_started_at = new Date().toISOString();
      }
      return claimed.map((e) => ({ ...e }));
    },
    async listStuckGrading(cutoffIso) {
      return entries
        .filter(
          (e) =>
            e.status === "grading" &&
            e.grading_started_at !== null &&
            e.grading_started_at < cutoffIso,
        )
        .map((e) => ({ ...e }));
    },
    async addScript(entryId, pageIndex, imagePath) {
      const script: MockScript = {
        id: nextId(),
        entry_id: entryId,
        page_index: pageIndex,
        image_path: imagePath,
        ocr_text: null,
        ocr_boxes: null,
      };
      scripts.push(script);
      return script;
    },
    async listScripts(entryId) {
      return scripts.filter((s) => s.entry_id === entryId);
    },
    async setScriptOcr(scriptId, text, boxes) {
      const script = scripts.find((s) => s.id === scriptId);
      if (script) {
        script.ocr_text = text;
        script.ocr_boxes = boxes;
      }
    },
    async upsertResult(row) {
      const i = results.findIndex((r) => r.entry_id === row.entry_id);
      if (i >= 0) results[i] = row;
      else results.push(row);
    },
    async getResult(entryId) {
      return results.find((r) => r.entry_id === entryId) ?? null;
    },
    async listResultsForEntries(entryIds) {
      return results.filter((r) => entryIds.includes(r.entry_id));
    },
    async getCountry(userId) {
      return seed.countries?.[userId] ?? null;
    },
    async historyScoreShare(userId) {
      const past = events.filter(
        (e) => e.userId === userId && e.kind === "mock_result",
      );
      if (past.length === 0) return null;
      const shares = past.map((e) => {
        const max = Number(e.payload.totalMax) || 1;
        return Number(e.payload.totalAwarded) / max;
      });
      return shares.reduce((a, b) => a + b, 0) / shares.length;
    },
    async priorScriptPath(userId, excludeEntryId) {
      const mine = entries.filter(
        (e) =>
          e.user_id === userId &&
          e.id !== excludeEntryId &&
          ["graded", "quarantined"].includes(e.status),
      );
      for (const entry of mine.reverse()) {
        const page = scripts.find((s) => s.entry_id === entry.id);
        if (page) return page.image_path;
      }
      return null;
    },
    async appendEvents(list) {
      events.push(...list);
    },
    async createIntegrityReview(input) {
      reviews.push({
        userId: input.userId,
        sourceId: input.sourceId,
        reason: input.reason,
      });
    },
    async notify(input) {
      notifications.push({ userId: input.userId, title: input.title });
    },
  };

  return Object.assign(store, {
    entries,
    scripts,
    results,
    events,
    reviews,
    notifications,
  });
}
