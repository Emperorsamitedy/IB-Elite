import { describe, expect, it } from "vitest";
import { createFakeMockStore } from "./fake-store";
import type { MockGrader } from "./grade";
import {
  enterSitting,
  gradeBatch,
  releaseDueResults,
  requeueStuckEntries,
  startEntry,
  submitEntry,
} from "./service";
import type { Criterion } from "./types";

const CRITERIA: Criterion[] = [
  { id: "c1", title: "Method", description: "correct method shown", maxMarks: 4 },
  { id: "c2", title: "Accuracy", description: "accurate final values", maxMarks: 6 },
];

const PAPER = {
  id: "paper-1",
  subject_id: "subject-1",
  level_code: "SL" as const,
  language: "en",
  title: "September Mock: Mechanics",
  body: "Q1. A ball is dropped…",
  duration_minutes: 90,
  markscheme: CRITERIA as unknown as never,
  status: "scheduled" as const,
};

const SITTING = {
  id: "sit-emea",
  paper_id: "paper-1",
  band: "emea" as const,
  opens_at: "2026-09-05T16:00:00Z",
  closes_at: "2026-09-05T18:30:00Z",
  results_at: "2026-09-06T07:00:00Z",
  status: "scheduled" as const,
};

/** Grader that awards marks proportional to transcript length, capped. */
function lengthGrader(): MockGrader {
  return {
    async grade(transcript, criteria) {
      const share = Math.min(1, transcript.length / 100);
      const awards = criteria.map((c) => ({
        criterionId: c.id,
        title: c.title,
        maxMarks: c.maxMarks,
        awarded: Math.round(share * c.maxMarks),
        comment: null,
      }));
      return {
        criteria: awards,
        totalAwarded: awards.reduce((s, a) => s + a.awarded, 0),
        totalMax: criteria.reduce((s, c) => s + c.maxMarks, 0),
        grader: "keywords",
      };
    },
  };
}

function makeStore(countries: Record<string, string> = {}) {
  return createFakeMockStore({
    papers: [PAPER],
    sittings: [SITTING],
    countries,
  });
}

const readScript = async (path: string) => ({
  text: path.includes("empty") ? "" : "a".repeat(120),
  words: [],
});

async function sitAndSubmit(
  store: ReturnType<typeof makeStore>,
  userId: string,
  opts?: { startIso?: string; submitIso?: string; scriptPath?: string },
) {
  const startAt = new Date(opts?.startIso ?? "2026-09-05T16:05:00Z");
  const { entry } = await startEntry(
    store,
    { sittingId: SITTING.id, userId },
    startAt,
  );
  await store.addScript(entry.id, 0, opts?.scriptPath ?? `scripts/${userId}.jpg`);
  return submitEntry(
    store,
    { sittingId: SITTING.id, userId },
    new Date(opts?.submitIso ?? "2026-09-05T17:20:00Z"),
  );
}

describe("sitting flow", () => {
  it("registers before the bell but never serves the paper early", async () => {
    const store = makeStore();
    const before = new Date("2026-09-05T10:00:00Z");
    const entry = await enterSitting(
      store,
      { sittingId: SITTING.id, userId: "alice" },
      before,
    );
    expect(entry.status).toBe("entered");
    await expect(
      startEntry(store, { sittingId: SITTING.id, userId: "alice" }, before),
    ).rejects.toThrow(/not open/i);
  });

  it("starting stamps the clock once and computes the deadline", async () => {
    const store = makeStore();
    const at = new Date("2026-09-05T16:05:00Z");
    const first = await startEntry(
      store,
      { sittingId: SITTING.id, userId: "alice" },
      at,
    );
    expect(first.deadline).toBe("2026-09-05T17:35:00.000Z");
    // Re-fetching later must not restart the clock.
    const again = await startEntry(
      store,
      { sittingId: SITTING.id, userId: "alice" },
      new Date("2026-09-05T16:30:00Z"),
    );
    expect(again.entry.started_at).toBe(first.entry.started_at);
  });

  it("requires a script and marks overdue submissions late", async () => {
    const store = makeStore();
    await startEntry(
      store,
      { sittingId: SITTING.id, userId: "alice" },
      new Date("2026-09-05T16:00:00Z"),
    );
    await expect(
      submitEntry(
        store,
        { sittingId: SITTING.id, userId: "alice" },
        new Date("2026-09-05T17:00:00Z"),
      ),
    ).rejects.toThrow(/at least one page/i);

    const onTime = await sitAndSubmit(store, "bob");
    expect(onTime.status).toBe("submitted");

    const late = await sitAndSubmit(store, "carol", {
      startIso: "2026-09-05T16:00:00Z",
      submitIso: "2026-09-05T17:45:00Z", // 105min into a 90min paper
    });
    expect(late.status).toBe("late");
  });
});

describe("grading batch", () => {
  it("OCRs, grades, and stores unreleased results", async () => {
    const store = makeStore();
    await sitAndSubmit(store, "alice");
    const outcome = await gradeBatch(
      store,
      lengthGrader(),
      readScript,
      10,
      new Date("2026-09-06T02:00:00Z"),
    );
    expect(outcome).toEqual({ graded: 1, quarantined: 0 });
    const result = store.results[0];
    expect(result.total_awarded).toBe(10);
    expect(result.released).toBe(false);
    expect(store.entries[0].status).toBe("graded");
    expect(store.scripts[0].ocr_text).not.toBeNull();
  });

  it("quarantines a high score written impossibly fast", async () => {
    const store = makeStore();
    await sitAndSubmit(store, "cheat", {
      startIso: "2026-09-05T16:00:00Z",
      submitIso: "2026-09-05T16:06:00Z", // 6 of 90 minutes
    });
    const outcome = await gradeBatch(
      store,
      lengthGrader(),
      readScript,
      10,
      new Date("2026-09-06T02:00:00Z"),
    );
    expect(outcome.quarantined).toBe(1);
    expect(store.entries[0].status).toBe("quarantined");
    expect(store.reviews).toHaveLength(1);
  });
});

describe("results day", () => {
  async function gradedCohort(n: number, countries: Record<string, string> = {}) {
    const store = makeStore(countries);
    for (let i = 0; i < n; i++) {
      // Vary script length → varying scores.
      await sitAndSubmit(store, `s${i}`, { scriptPath: `p/${i}.jpg` });
    }
    const grader: MockGrader = {
      async grade(_t, criteria) {
        const idx = Number(_t.split("|")[1] ?? 0);
        const awards = criteria.map((c) => ({
          criterionId: c.id,
          title: c.title,
          maxMarks: c.maxMarks,
          awarded: Math.min(c.maxMarks, idx),
          comment: null,
        }));
        return {
          criteria: awards,
          totalAwarded: awards.reduce((s, a) => s + a.awarded, 0),
          totalMax: 10,
          grader: "keywords",
        };
      },
    };
    await gradeBatch(
      store,
      grader,
      // Long enough that the empty-script integrity check stays quiet.
      async (path) => ({
        text: `${"x".repeat(120)}|${path.replace(/\D/g, "")}`,
        words: [],
      }),
      50,
      new Date("2026-09-06T02:00:00Z"),
    );
    return store;
  }

  it("holds results until the queue is drained and results_at passes", async () => {
    const store = makeStore();
    await sitAndSubmit(store, "alice");
    // Not graded yet → nothing releases even after results_at.
    let out = await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T08:00:00Z"));
    expect(out.papersReleased).toBe(0);

    await gradeBatch(store, lengthGrader(), readScript, 10, new Date());
    // Graded but before results_at → still held.
    out = await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T06:00:00Z"));
    expect(out.papersReleased).toBe(0);

    out = await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T08:00:00Z"));
    expect(out).toEqual({ papersReleased: 1, entriesReleased: 1 });
    expect(store.results[0].released).toBe(true);
    expect(store.notifications.some((n) => n.userId === "alice")).toBe(true);
  });

  it("computes global percentiles over the ranked cohort", async () => {
    const store = await gradedCohort(6);
    const out = await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T08:00:00Z"));
    expect(out.entriesReleased).toBe(6);
    const best = store.results.find((r) => r.total_awarded === 9)!; // idx 5 → min(4,5)+min(6,5)=9
    const worst = store.results.find((r) => r.total_awarded === 0)!;
    expect(best.global_percentile).toBeGreaterThan(80);
    expect(worst.global_percentile).toBe(0);
  });

  it("hides percentiles below the minimum cohort", async () => {
    const store = await gradedCohort(3);
    await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T08:00:00Z"));
    for (const result of store.results) {
      expect(result.released).toBe(true);
      expect(result.global_percentile).toBeNull();
    }
  });

  it("late entries get marks but never a rank; ledger records it", async () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) await sitAndSubmit(store, `s${i}`, { scriptPath: `p/${i}.jpg` });
    await sitAndSubmit(store, "tardy", {
      startIso: "2026-09-05T16:00:00Z",
      submitIso: "2026-09-05T18:00:00Z",
    });
    await gradeBatch(store, lengthGrader(), readScript, 50, new Date());
    await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T08:00:00Z"));

    const tardyEntry = store.entries.find((e) => e.user_id === "tardy")!;
    const tardyResult = store.results.find((r) => r.entry_id === tardyEntry.id)!;
    expect(tardyResult.released).toBe(true);
    expect(tardyResult.total_awarded).toBeGreaterThan(0);
    expect(tardyResult.global_percentile).toBeNull();
    const event = store.events.find((e) => e.userId === "tardy")!;
    expect(event.payload.ranked).toBe(false);
  });

  it("country percentile needs a country and its own minimum cohort", async () => {
    const countries: Record<string, string> = {};
    for (let i = 0; i < 6; i++) countries[`s${i}`] = i < 5 ? "ET" : "GB";
    const store = await gradedCohort(6, countries);
    await releaseDueResults(store, [PAPER.id], new Date("2026-09-06T08:00:00Z"));

    const gbEntry = store.entries.find((e) => e.user_id === "s5")!;
    const gbResult = store.results.find((r) => r.entry_id === gbEntry.id)!;
    expect(gbResult.country_percentile).toBeNull(); // cohort of 1
    expect(gbResult.country_rank).toBe(1);

    const etEntry = store.entries.find((e) => e.user_id === "s0")!;
    const etResult = store.results.find((r) => r.entry_id === etEntry.id)!;
    expect(etResult.country_percentile).not.toBeNull();
  });
});

describe("stuck-grading recovery", () => {
  it("requeues abandoned claims and Results Day still happens", async () => {
    const store = makeStore();
    await sitAndSubmit(store, "alice");

    // A worker claims the entry, then dies before writing a result.
    const claimed = await store.claimEntries(10);
    expect(claimed).toHaveLength(1);
    expect(store.entries[0].status).toBe("grading");

    // Too fresh to touch…
    let swept = await requeueStuckEntries(store, new Date(), 15);
    expect(swept.requeued).toBe(0);

    // …but after the stale window it goes back to the queue.
    const later = new Date(Date.now() + 20 * 60_000);
    swept = await requeueStuckEntries(store, later, 15);
    expect(swept.requeued).toBe(1);
    expect(store.entries[0].status).toBe("submitted");
    expect(store.entries[0].grading_started_at).toBeNull();

    // The next heartbeat grades it and the paper can release.
    await gradeBatch(store, lengthGrader(), readScript, 10, later);
    const out = await releaseDueResults(
      store,
      [PAPER.id],
      new Date("2026-09-06T08:00:00Z"),
    );
    expect(out).toEqual({ papersReleased: 1, entriesReleased: 1 });
  });

  it("restores the late status for a stuck late submission", async () => {
    const store = makeStore();
    await sitAndSubmit(store, "tardy", {
      startIso: "2026-09-05T16:00:00Z",
      submitIso: "2026-09-05T18:00:00Z", // past the 90min paper
    });
    expect(store.entries[0].status).toBe("late");
    await store.claimEntries(10);
    const later = new Date(Date.now() + 20 * 60_000);
    await requeueStuckEntries(store, later, 15);
    expect(store.entries[0].status).toBe("late");
  });

  it("never touches entries a live worker is holding", async () => {
    const store = makeStore();
    await sitAndSubmit(store, "alice");
    await store.claimEntries(10);
    const swept = await requeueStuckEntries(store, new Date(), 15);
    expect(swept.requeued).toBe(0);
    expect(store.entries[0].status).toBe("grading");
  });
});

describe("annotated script anchoring", () => {
  it("pins each criterion's evidence to a page and box", async () => {
    const store = makeStore();
    const { entry } = await startEntry(
      store,
      { sittingId: SITTING.id, userId: "alice" },
      new Date("2026-09-05T16:05:00Z"),
    );
    await store.addScript(entry.id, 0, "p/page0.jpg");
    await store.addScript(entry.id, 1, "p/page1.jpg");
    await submitEntry(
      store,
      { sittingId: SITTING.id, userId: "alice" },
      new Date("2026-09-05T17:20:00Z"),
    );

    const grader: MockGrader = {
      async grade(_t, criteria) {
        const awards = criteria.map((c, i) => ({
          criterionId: c.id,
          title: c.title,
          maxMarks: c.maxMarks,
          awarded: c.maxMarks,
          comment: null,
          evidence: i === 0 ? "swaps x and y" : "x equals two",
        }));
        return {
          criteria: awards,
          totalAwarded: awards.reduce((s, a) => s + a.awarded, 0),
          totalMax: 10,
          grader: "ai" as const,
        };
      },
    };
    const pageOcr = async (path: string) =>
      path.includes("page0")
        ? {
            text: "I swaps x and y to invert the function ".repeat(3),
            words: [
              { text: "swaps x and y to invert", box: { x: 10, y: 20, width: 200, height: 24 } },
            ],
          }
        : {
            text: "therefore x equals two exactly ".repeat(4),
            words: [
              { text: "therefore x equals two", box: { x: 5, y: 300, width: 180, height: 22 } },
            ],
          };

    await gradeBatch(store, grader, pageOcr, 10, new Date("2026-09-06T02:00:00Z"));

    const result = store.results[0];
    const [first, second] = result.criteria;
    expect(first.pageIndex).toBe(0);
    expect(first.box).toEqual({ x: 10, y: 20, width: 200, height: 24 });
    expect(second.pageIndex).toBe(1);
    expect(second.box).toEqual({ x: 5, y: 300, width: 180, height: 22 });
    // Boxes survive the store round-trip on the scripts too.
    expect(store.scripts[0].ocr_boxes).toHaveLength(1);
  });
});
