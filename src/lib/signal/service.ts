import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeSignal,
  SIGNAL_ALGORITHM_VERSION,
  verificationTier,
  type LedgerEvent,
} from "./rating";

/**
 * Recomputes every user's per-subject Signal from the ledger. Ratings are
 * derived state: this is idempotent and safe to re-run under any
 * algorithm version bump.
 */
export async function recomputeSignals(now: Date): Promise<{ rated: number }> {
  const admin = createAdminClient();

  const { data: events } = await admin
    .from("performance_events")
    .select("user_id, subject_id, kind, payload, quarantined, created_at")
    .order("created_at");
  if (!events || events.length === 0) return { rated: 0 };

  // Integrity posture per user feeds the verification tier.
  const { data: reviews } = await admin
    .from("integrity_reviews")
    .select("user_id, status");
  const reviewsByUser = new Map<string, { upheld: number; pending: number }>();
  for (const review of reviews ?? []) {
    const entry = reviewsByUser.get(review.user_id) ?? { upheld: 0, pending: 0 };
    if (review.status === "upheld") entry.upheld += 1;
    if (review.status === "pending") entry.pending += 1;
    reviewsByUser.set(review.user_id, entry);
  }

  const byUserSubject = new Map<string, LedgerEvent[]>();
  const kindsByUser = new Map<string, Set<string>>();
  const cleanByUser = new Map<string, number>();
  for (const event of events) {
    if (!event.subject_id) continue;
    const key = `${event.user_id}:${event.subject_id}`;
    const list = byUserSubject.get(key) ?? [];
    list.push({
      kind: event.kind,
      payload: event.payload as Record<string, unknown>,
      quarantined: event.quarantined,
      created_at: event.created_at,
    });
    byUserSubject.set(key, list);
    if (!event.quarantined) {
      cleanByUser.set(event.user_id, (cleanByUser.get(event.user_id) ?? 0) + 1);
      const kinds = kindsByUser.get(event.user_id) ?? new Set();
      kinds.add(event.kind);
      kindsByUser.set(event.user_id, kinds);
    }
  }

  let rated = 0;
  for (const [key, ledger] of byUserSubject) {
    const [userId, subjectId] = key.split(":");
    const signal = computeSignal(ledger);
    if (!signal) continue;
    const posture = reviewsByUser.get(userId) ?? { upheld: 0, pending: 0 };
    const tier = verificationTier({
      cleanEvents: cleanByUser.get(userId) ?? 0,
      evidenceKinds: kindsByUser.get(userId)?.size ?? 0,
      upheldReviews: posture.upheld,
      pendingReviews: posture.pending,
    });
    await admin.from("signal_ratings").upsert({
      user_id: userId,
      subject_id: subjectId,
      rating: signal.rating,
      confidence: signal.confidence,
      sample_size: signal.sampleSize,
      trajectory: signal.trajectory,
      verification_tier: tier,
      algorithm_version: SIGNAL_ALGORITHM_VERSION,
      computed_at: now.toISOString(),
    });
    rated += 1;
  }
  return { rated };
}
