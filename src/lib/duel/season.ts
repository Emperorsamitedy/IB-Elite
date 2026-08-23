/**
 * Seasons are UTC calendar months, identified by slug ('2026-09') and
 * created lazily on first use — no cron dependency for the core loop.
 */

export function seasonSlug(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function seasonBounds(date: Date): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const endsAt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  );
  return { startsAt, endsAt };
}

export function previousSeasonSlug(slug: string): string {
  const [year, month] = slug.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return seasonSlug(prev);
}
