/**
 * City names key the city leaderboard by equality, so every write funnels
 * through one normalization: trimmed, single-spaced, Title Case. Matching
 * is additionally case-insensitive to absorb legacy rows.
 */
export function normalizeCity(city: string | null | undefined): string | null {
  const collapsed = city?.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  return collapsed
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
