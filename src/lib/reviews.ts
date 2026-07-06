// Rating aggregation helpers for meal reviews.

export type RatingSummary = { avg: number; count: number };

/** Average (rounded to 1 decimal) + count from a list of 1–5 ratings. */
export function summarizeRatings(ratings: number[]): RatingSummary {
  const count = ratings.length;
  if (count === 0) return { avg: 0, count: 0 };
  const avg = ratings.reduce((s, r) => s + r, 0) / count;
  return { avg: Math.round(avg * 10) / 10, count };
}

/** Full/half/empty star breakdown for rendering (out of 5). */
export function starParts(avg: number): { full: number; half: boolean; empty: number } {
  const clamped = Math.min(5, Math.max(0, avg));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
}
