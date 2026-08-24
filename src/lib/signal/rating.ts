/**
 * Signal v1: a 0–100 academic rating per subject from the immutable ledger.
 * Every parameter here is recorded in rating_algorithm_versions('signal', 1)
 * so historical ratings can be recomputed and explained.
 *
 * Weighted mean of normalized event scores — World Mock results carry the
 * most weight, ranked duels next, graded practice least — with a confidence
 * that grows with sample size and evidence diversity, and a trajectory from
 * comparing the recent third against the rest.
 */

export const SIGNAL_ALGORITHM_VERSION = 1;

export type LedgerEvent = {
  kind: string;
  payload: Record<string, unknown>;
  quarantined: boolean;
  created_at: string;
};

export type SignalRating = {
  rating: number;
  confidence: number;
  sampleSize: number;
  trajectory: "improving" | "stable" | "declining";
};

const WEIGHTS: Record<string, number> = {
  mock_result: 3,
  duel_result: 2,
  practice_result: 1,
};
const CONFIDENCE_K = 10;
const TRAJECTORY_THRESHOLD = 5;

/** Normalized 0–100 evidence value for one event; null = not rateable. */
export function eventValue(event: LedgerEvent): number | null {
  if (event.quarantined) return null;
  const p = event.payload;
  switch (event.kind) {
    case "mock_result": {
      if (p.ranked !== true) return null;
      const pct = Number(p.globalPercentile);
      return Number.isFinite(pct) ? clamp(pct) : null;
    }
    case "duel_result": {
      if (p.mode === "friendly") return null;
      const elo = Number(p.eloAfter);
      if (!Number.isFinite(elo)) return null;
      // 800 → 0, 2000 → 100; the observed rating range of the ladder.
      return clamp(((elo - 800) / 1200) * 100);
    }
    case "practice_result": {
      const total = Number(p.total);
      const awarded = Number(p.awarded);
      if (!Number.isFinite(total) || total <= 0) return null;
      return clamp((awarded / total) * 100);
    }
    default:
      return null;
  }
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * The rating over a user's ledger for one subject, oldest event first.
 * Returns null when there is no rateable evidence at all.
 */
export function computeSignal(events: LedgerEvent[]): SignalRating | null {
  const rated: { value: number; weight: number; at: number }[] = [];
  for (const event of events) {
    const value = eventValue(event);
    if (value === null) continue;
    rated.push({
      value,
      weight: WEIGHTS[event.kind] ?? 0,
      at: new Date(event.created_at).getTime(),
    });
  }
  if (rated.length === 0) return null;
  rated.sort((a, b) => a.at - b.at);

  const rating = weightedMean(rated);

  // Confidence: saturating in sample size, discounted for one-note evidence.
  const kinds = new Set(
    events.filter((e) => eventValue(e) !== null).map((e) => e.kind),
  );
  const diversity = 0.6 + 0.2 * Math.min(2, kinds.size - 1);
  const confidence =
    Math.round((1 - Math.exp(-rated.length / CONFIDENCE_K)) * diversity * 100) /
    100;

  // Trajectory: the recent third against everything before it.
  let trajectory: SignalRating["trajectory"] = "stable";
  if (rated.length >= 6) {
    const cut = Math.floor((rated.length * 2) / 3);
    const earlier = weightedMean(rated.slice(0, cut));
    const recent = weightedMean(rated.slice(cut));
    if (recent - earlier > TRAJECTORY_THRESHOLD) trajectory = "improving";
    else if (earlier - recent > TRAJECTORY_THRESHOLD) trajectory = "declining";
  }

  return {
    rating: Math.round(rating * 10) / 10,
    confidence,
    sampleSize: rated.length,
    trajectory,
  };
}

function weightedMean(rated: { value: number; weight: number }[]): number {
  const totalWeight = rated.reduce((sum, r) => sum + r.weight, 0);
  if (totalWeight === 0) return 0;
  return rated.reduce((sum, r) => sum + r.value * r.weight, 0) / totalWeight;
}

/**
 * Verification tier from integrity history: Verified needs a body of clean
 * evidence across at least two evidence kinds and zero upheld reviews.
 * Proctored is reserved for supervised sittings (Phase E+).
 */
export function verificationTier(input: {
  cleanEvents: number;
  evidenceKinds: number;
  upheldReviews: number;
  pendingReviews: number;
}): "standard" | "verified" {
  if (input.upheldReviews > 0 || input.pendingReviews > 0) return "standard";
  if (input.cleanEvents >= 15 && input.evidenceKinds >= 2) return "verified";
  return "standard";
}

/** Signal (0–100) mapped onto the IB 1–7 scale for calibration receipts. */
export function signalToGrade(rating: number): number {
  return Math.min(7, Math.max(1, Math.ceil(rating / (100 / 7))));
}

export type CalibrationReport = {
  predicted_rating: number;
  official_grade: number;
};

/** Share of reports where the Signal predicted within one IB grade. */
export function calibrationAccuracy(reports: CalibrationReport[]): {
  withinOne: number | null;
  count: number;
} {
  if (reports.length === 0) return { withinOne: null, count: 0 };
  const hits = reports.filter(
    (r) => Math.abs(signalToGrade(r.predicted_rating) - r.official_grade) <= 1,
  ).length;
  return {
    withinOne: Math.round((hits / reports.length) * 100),
    count: reports.length,
  };
}
