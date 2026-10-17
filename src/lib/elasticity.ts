// Price-elasticity guidance for the what-if simulator.
//
// There is no universal "$1 up loses X%" rule, but there is a well-studied
// ratio: price elasticity of demand. The most-cited review of food pricing
// studies (Andreyeva, Long & Brownell, AJPH 2010) puts food away from home at
// about 0.8: a 10% price rise loses roughly 8% of volume. Subscribers with a
// habit and a saved card sit at the forgiving end; one-time buyers at the
// sensitive end. Increases under ~5% rarely register; above 10% they do.

export type ElasticityPreset = "loyal" | "typical" | "sensitive" | "custom";

export const PRESETS: { key: Exclude<ElasticityPreset, "custom">; label: string; e: number; blurb: string }[] = [
  { key: "loyal", label: "Loyal subscribers", e: 0.5, blurb: "Weekly plans, saved cards, a habit. A 10% rise loses about 5% of volume." },
  { key: "typical", label: "Typical", e: 0.8, blurb: "The published average for food away from home. A 10% rise loses about 8%." },
  { key: "sensitive", label: "Price-sensitive", e: 1.2, blurb: "One-time buyers who compare. A 10% rise loses about 12%." },
];

/** Percent change in price, e.g. 14.00 → 20.72 = +48. */
export function priceChangePct(oldCents: number, newCents: number): number {
  if (oldCents <= 0) return 0;
  return ((newCents - oldCents) / oldCents) * 100;
}

/**
 * Expected percent change in volume for a price change at a given elasticity.
 * Clamped to [-95, +300] so a silly price never produces a silly volume.
 */
export function expectedVolumeChangePct(priceChange: number, elasticity: number): number {
  const v = -priceChange * elasticity;
  return Math.max(-95, Math.min(300, Math.round(v)));
}

export type Threshold = "none" | "noticeable" | "big" | "round-number";

/**
 * Psychological thresholds menu-pricing practice is consistent on: under ~5% is
 * rarely noticed, over 10% is, and crossing a whole-dollar line registers more
 * than the arithmetic suggests.
 */
export function thresholdWarning(oldCents: number, newCents: number): Threshold {
  if (newCents <= oldCents) return "none";
  const pct = priceChangePct(oldCents, newCents);
  if (pct > 10) return "big";
  if (Math.floor(newCents / 100) > Math.floor(oldCents / 100) && pct >= 5) return "round-number";
  if (pct >= 5) return "noticeable";
  return "none";
}

/**
 * One line of plain advice: compare the expected volume loss at this elasticity
 * with the loss the kitchen can afford before contribution falls.
 */
export function elasticityAdvice(input: {
  priceChange: number; // %
  expectedVolume: number; // % (negative = loss)
  affordableLoss: number | null; // % of volume you can lose and still break even (positive number), null if n/a
  presetLabel: string;
}): { tone: "good" | "caution" | "bad" | "neutral"; text: string } {
  const { priceChange, expectedVolume, affordableLoss, presetLabel } = input;
  if (Math.abs(priceChange) < 0.5) return { tone: "neutral", text: "Move the price to see what a typical customer response would do to your contribution." };
  if (priceChange < 0) {
    return { tone: "neutral", text: `At a ${presetLabel.toLowerCase()} response, a ${Math.abs(priceChange).toFixed(0)}% cut should bring about ${Math.abs(expectedVolume)}% more volume. Check the contribution line: cuts only pay if the extra plates cover the lost margin.` };
  }
  const loss = Math.abs(expectedVolume);
  if (affordableLoss == null) return { tone: "neutral", text: `At a ${presetLabel.toLowerCase()} response, expect to lose about ${loss}% of volume at this price.` };
  if (loss <= affordableLoss * 0.6) return { tone: "good", text: `At a ${presetLabel.toLowerCase()} response, expect to lose about ${loss}% of volume. You can afford to lose ${affordableLoss}%, so this change should pay.` };
  if (loss <= affordableLoss) return { tone: "caution", text: `At a ${presetLabel.toLowerCase()} response, expect to lose about ${loss}% of volume. You can afford ${affordableLoss}%, so this is close to the line. Consider a smaller step.` };
  return { tone: "bad", text: `At a ${presetLabel.toLowerCase()} response, expect to lose about ${loss}% of volume, more than the ${affordableLoss}% you can afford. Step up in two or three moves instead of one.` };
}
