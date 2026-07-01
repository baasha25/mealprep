// Loyalty & referral math — pure integer functions (points are whole numbers,
// money in cents). CLAUDE.md §9: money math must not break.

/** Points earned for an order, from its pre-discount subtotal. */
export function pointsForOrder(subtotalCents: number, pointsPerDollar: number): number {
  if (subtotalCents <= 0 || pointsPerDollar <= 0) return 0;
  return Math.floor((subtotalCents / 100) * pointsPerDollar);
}

/** Cash value (cents) of a points balance at the configured redemption rate. */
export function redeemableValueCents(points: number, centsPerPoint: number): number {
  if (points <= 0 || centsPerPoint <= 0) return 0;
  return points * centsPerPoint;
}

/**
 * How many points a customer may redeem against an order:
 * capped by their balance AND by not exceeding the order total.
 */
export function maxRedeemablePoints(
  balance: number,
  orderCapCents: number,
  centsPerPoint: number,
): number {
  if (balance <= 0 || orderCapCents <= 0 || centsPerPoint <= 0) return 0;
  const affordable = Math.floor(orderCapCents / centsPerPoint);
  return Math.max(0, Math.min(balance, affordable));
}

/** Clamp a requested redemption to what's actually allowed, returning points + cents. */
export function resolveRedemption(
  requestedPoints: number,
  balance: number,
  orderCapCents: number,
  centsPerPoint: number,
): { points: number; cents: number } {
  const max = maxRedeemablePoints(balance, orderCapCents, centsPerPoint);
  const points = Math.max(0, Math.min(Math.floor(requestedPoints || 0), max));
  return { points, cents: points * centsPerPoint };
}

// Referral code: short, human-readable, ambiguity-free (no 0/O/1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function referralCodeFrom(name: string, seed: number): string {
  const initials = (name.match(/[A-Za-z]/g) ?? ["X"]).slice(0, 3).join("").toUpperCase();
  let n = seed;
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[n % CODE_ALPHABET.length];
    n = Math.floor(n / CODE_ALPHABET.length) + (i + 3) * 11;
  }
  return `${initials}-${suffix}`;
}
