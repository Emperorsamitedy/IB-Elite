import type { Json } from "@/lib/supabase/database.types";
import { flagMockEntry, shouldQuarantineMock } from "./integrity";
import type { MockGrader } from "./grade";
import {
  MIN_COHORT,
  percentileRank,
  rankOf,
} from "./percentiles";
import type {
  EntryWithSitting,
  MockEntry,
  MockPaper,
  MockStore,
} from "./store";
import type { Criterion } from "./types";
import { isLate, sittingPhase } from "./windows";

export class MockError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function criteriaOf(paper: MockPaper): Criterion[] {
  return Array.isArray(paper.markscheme)
    ? (paper.markscheme as unknown as Criterion[])
    : [];
}

// ---------------------------------------------------------------
// Sitting the paper
// ---------------------------------------------------------------

/** Registers the student for a sitting; allowed any time before it closes. */
export async function enterSitting(
  store: MockStore,
  input: { sittingId: string; userId: string },
  now: Date,
): Promise<MockEntry> {
  const sitting = await store.getSitting(input.sittingId);
  if (!sitting) throw new MockError("Sitting not found", 404);
  const phase = sittingPhase(sitting, now);
  if (phase === "cancelled") throw new MockError("This sitting was cancelled", 409);
  if (phase === "closed") throw new MockError("This sitting has closed", 409);

  const existing = await store.getEntry(input.sittingId, input.userId);
  if (existing) return existing;
  return store.createEntry(input.sittingId, input.userId);
}

/**
 * Release-at-the-bell: the paper body leaves the server only through here,
 * only while the window is open, and starting stamps the student's clock.
 */
export async function startEntry(
  store: MockStore,
  input: { sittingId: string; userId: string },
  now: Date,
): Promise<{ entry: MockEntry; paper: MockPaper; deadline: string }> {
  const sitting = await store.getSitting(input.sittingId);
  if (!sitting) throw new MockError("Sitting not found", 404);
  if (sittingPhase(sitting, now) !== "open") {
    throw new MockError("The exam window is not open", 409);
  }
  const paper = await store.getPaper(sitting.paper_id);
  if (!paper || paper.status !== "scheduled") {
    throw new MockError("Paper unavailable", 409);
  }

  let entry = await store.getEntry(input.sittingId, input.userId);
  if (!entry) entry = await store.createEntry(input.sittingId, input.userId);
  if (!entry.started_at) {
    entry = await store.updateEntry(entry.id, {
      status: "started",
      started_at: now.toISOString(),
    });
  }

  const own =
    new Date(entry.started_at!).getTime() + paper.duration_minutes * 60_000;
  const deadline = new Date(
    Math.min(own, new Date(sitting.closes_at).getTime()),
  ).toISOString();
  return { entry, paper, deadline };
}

/** Marks the script set final. Late arrivals are graded but never ranked. */
export async function submitEntry(
  store: MockStore,
  input: { sittingId: string; userId: string },
  now: Date,
): Promise<MockEntry> {
  const sitting = await store.getSitting(input.sittingId);
  if (!sitting) throw new MockError("Sitting not found", 404);
  const entry = await store.getEntry(input.sittingId, input.userId);
  if (!entry?.started_at) throw new MockError("Start the paper first", 409);
  if (entry.submitted_at) return entry;

  const scripts = await store.listScripts(entry.id);
  if (scripts.length === 0) {
    throw new MockError("Upload at least one page of your script", 400);
  }
  const paper = await store.getPaper(sitting.paper_id);
  if (!paper) throw new MockError("Paper unavailable", 409);

  const late = isLate(
    now,
    entry.started_at,
    paper.duration_minutes,
    sitting.closes_at,
  );
  return store.updateEntry(entry.id, {
    status: late ? "late" : "submitted",
    submitted_at: now.toISOString(),
  });
}

// ---------------------------------------------------------------
// Overnight grading
// ---------------------------------------------------------------

export type GradeBatchResult = { graded: number; quarantined: number };

/** How long a claim may hold an entry before it counts as abandoned. */
export const GRADING_STALE_MINUTES = 15;

/**
 * Requeues entries a dead worker left in 'grading'. Their submitted/late
 * status is recomputed from timestamps, so nothing is lost — the next
 * grading pass simply picks them up again. Without this, one crashed
 * worker could block a paper's Results Day forever.
 */
export async function requeueStuckEntries(
  store: MockStore,
  now: Date,
  staleMinutes: number = GRADING_STALE_MINUTES,
): Promise<{ requeued: number }> {
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000).toISOString();
  const stuck = await store.listStuckGrading(cutoff);
  let requeued = 0;
  for (const entry of stuck) {
    const sitting = await store.getSitting(entry.sitting_id);
    const paper = sitting ? await store.getPaper(sitting.paper_id) : null;
    const late =
      Boolean(sitting && paper && entry.started_at && entry.submitted_at) &&
      isLate(
        new Date(entry.submitted_at!),
        entry.started_at!,
        paper!.duration_minutes,
        sitting!.closes_at,
      );
    await store.updateEntry(entry.id, {
      status: late ? "late" : "submitted",
      grading_started_at: null,
    });
    requeued += 1;
  }
  return { requeued };
}

/**
 * Claims a batch and grades each script end to end: OCR any page that still
 * needs it, mark per criterion, run integrity checks, write the (unreleased)
 * result. Idempotent and safe to run from parallel workers.
 */
export async function gradeBatch(
  store: MockStore,
  grader: MockGrader,
  readScript: (imagePath: string) => Promise<string>,
  batch: number,
  now: Date,
): Promise<GradeBatchResult> {
  const claimed = await store.claimEntries(batch);
  let graded = 0;
  let quarantined = 0;

  for (const entry of claimed) {
    const sitting = await store.getSitting(entry.sitting_id);
    const paper = sitting ? await store.getPaper(sitting.paper_id) : null;
    if (!sitting || !paper) continue;

    const scripts = await store.listScripts(entry.id);
    const pages: string[] = [];
    for (const script of scripts) {
      let text = script.ocr_text;
      if (text === null) {
        text = await readScript(script.image_path).catch(() => "");
        await store.setScriptOcr(script.id, text);
      }
      pages.push(text);
    }
    const transcript = pages.join("\n\n").trim();

    const criteria = criteriaOf(paper);
    const outcome = await grader.grade(transcript, criteria);

    const scoreShare =
      outcome.totalMax > 0 ? outcome.totalAwarded / outcome.totalMax : 0;
    const flags = flagMockEntry({
      durationMinutes: paper.duration_minutes,
      startedAt: entry.started_at ?? entry.submitted_at ?? now.toISOString(),
      submittedAt: entry.submitted_at ?? now.toISOString(),
      transcriptLength: transcript.length,
      scoreShare,
      historyScoreShare: await store.historyScoreShare(entry.user_id),
    });
    const quarantine = shouldQuarantineMock(flags);
    if (flags.length > 0) {
      await store.createIntegrityReview({
        userId: entry.user_id,
        sourceId: entry.id,
        reason: flags.map((f) => f.code).join(","),
        details: { flags: flags as unknown as Json },
      });
    }

    await store.upsertResult({
      entry_id: entry.id,
      total_awarded: outcome.totalAwarded,
      total_max: outcome.totalMax,
      criteria: outcome.criteria,
      grader: outcome.grader,
      global_percentile: null,
      country_percentile: null,
      country_rank: null,
      released: false,
    });
    await store.updateEntry(entry.id, {
      status: quarantine ? "quarantined" : "graded",
    });
    graded += 1;
    if (quarantine) quarantined += 1;
  }
  return { graded, quarantined };
}

// ---------------------------------------------------------------
// Results Day
// ---------------------------------------------------------------

export type ReleaseResult = { papersReleased: number; entriesReleased: number };

/**
 * Releases every paper whose sittings have all closed, whose grading queue
 * is drained, and whose results time has passed. Percentiles rank the
 * on-time, non-quarantined cohort across all bands of the paper; late and
 * quarantined entries get their marks but no rank.
 */
export async function releaseDueResults(
  store: MockStore,
  paperIds: string[],
  now: Date,
): Promise<ReleaseResult> {
  let papersReleased = 0;
  let entriesReleased = 0;

  for (const paperId of paperIds) {
    const paper = await store.getPaper(paperId);
    if (!paper || paper.status !== "scheduled") continue;
    const sittings = await store.listSittingsForPaper(paperId);
    const live = sittings.filter((s) => s.status === "scheduled");
    if (live.length === 0) continue;
    if (live.some((s) => new Date(s.results_at).getTime() > now.getTime())) {
      continue;
    }

    const entries = await store.listEntriesForPaper(paperId);
    const participating = entries.filter((e) => e.submitted_at !== null);
    // Grading must be drained before anyone sees a percentile.
    if (participating.some((e) => ["submitted", "late", "grading"].includes(e.status))) {
      continue;
    }

    const results = await store.listResultsForEntries(
      participating.map((e) => e.id),
    );
    if (results.some((r) => r.released)) continue; // already out

    const resultOf = new Map(results.map((r) => [r.entry_id, r]));
    const ranked = participating.filter(
      (e) => e.status === "graded" && !isEntryLate(e, paper) && resultOf.has(e.id),
    );
    const rankedScores = ranked.map((e) => resultOf.get(e.id)!.total_awarded);

    const countries = new Map<string, string | null>();
    for (const e of participating) {
      countries.set(e.user_id, await store.getCountry(e.user_id));
    }

    for (const entry of participating) {
      const result = resultOf.get(entry.id);
      if (!result) continue;
      const isRanked = ranked.some((e) => e.id === entry.id);

      let globalPercentile: number | null = null;
      let countryPercentile: number | null = null;
      let countryRank: number | null = null;
      if (isRanked && rankedScores.length >= MIN_COHORT) {
        globalPercentile = percentileRank(rankedScores, result.total_awarded);
        const country = countries.get(entry.user_id);
        if (country) {
          const cohort = ranked.filter(
            (e) => countries.get(e.user_id) === country,
          );
          const cohortScores = cohort.map(
            (e) => resultOf.get(e.id)!.total_awarded,
          );
          if (cohortScores.length >= MIN_COHORT) {
            countryPercentile = percentileRank(
              cohortScores,
              result.total_awarded,
            );
          }
          countryRank = rankOf(cohortScores, result.total_awarded);
        }
      }

      await store.upsertResult({
        ...result,
        global_percentile: globalPercentile,
        country_percentile: countryPercentile,
        country_rank: countryRank,
        released: true,
      });
      await store.appendEvents([
        {
          userId: entry.user_id,
          subjectId: paper.subject_id,
          kind: "mock_result",
          payload: {
            paperId,
            sittingId: entry.sitting_id,
            band: entry.band,
            totalAwarded: result.total_awarded,
            totalMax: result.total_max,
            globalPercentile,
            ranked: isRanked,
          },
          quarantined: entry.status === "quarantined",
        },
      ]);
      await store.notify({
        userId: entry.user_id,
        category: "mock",
        title: `Results are out: ${paper.title}`,
        body:
          globalPercentile !== null
            ? `${result.total_awarded}/${result.total_max} — top ${Math.max(1, 100 - globalPercentile)}% worldwide`
            : `${result.total_awarded}/${result.total_max}`,
        href: `/mock/${entry.sitting_id}`,
      });
      entriesReleased += 1;
    }
    papersReleased += 1;
  }
  return { papersReleased, entriesReleased };
}

function isEntryLate(entry: EntryWithSitting, paper: MockPaper): boolean {
  if (!entry.started_at || !entry.submitted_at) return true;
  return isLate(
    new Date(entry.submitted_at),
    entry.started_at,
    paper.duration_minutes,
    entry.closes_at,
  );
}
