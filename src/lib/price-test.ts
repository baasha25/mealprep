// Price-test loop — pure (tested).
//
// PrepFlow owns the storefront and the orders, so it can close the loop a
// research tool can't: run a meal at a test price for a week or two, compare
// how many sold per day and what each day contributed against the same-length
// window before, and say plainly whether to keep the new price.

export type Window = { from: Date; to: Date; days: number };

/** Baseline = the `days` before start; test = start → min(now, end). */
export function experimentWindows(startAt: Date, endAt: Date, now: Date = new Date()): { baseline: Window; test: Window; plannedDays: number } {
  const dayMs = 86_400_000;
  const plannedDays = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / dayMs));
  const baseline = { from: new Date(startAt.getTime() - plannedDays * dayMs), to: startAt, days: plannedDays };
  const testTo = now < endAt ? now : endAt;
  const elapsed = Math.max(0, (testTo.getTime() - startAt.getTime()) / dayMs);
  return { baseline, test: { from: startAt, to: testTo, days: elapsed }, plannedDays };
}

export type Verdict = {
  baselineUnitsPerDay: number;
  testUnitsPerDay: number;
  unitsChangePct: number | null; // null when no baseline
  baselineContribPerDay: number; // cents
  testContribPerDay: number; // cents
  contribChangePct: number | null;
  recommendation: "keep" | "revert" | "too_early";
  reason: string;
};

/**
 * Compare per-day units and contribution (price − plate cost) between the two
 * windows. "too_early" until there are at least 5 test days or 10 test units;
 * otherwise keep when contribution per day went up, revert when it went down.
 */
export function experimentVerdict(o: { baselineUnits: number; baselineDays: number; testUnits: number; testDays: number; basePriceCents: number; testPriceCents: number; costCents: number }): Verdict {
  const bDays = Math.max(1, o.baselineDays);
  const tDays = Math.max(0.01, o.testDays);
  const bU = o.baselineUnits / bDays;
  const tU = o.testUnits / tDays;
  const bC = bU * (o.basePriceCents - o.costCents);
  const tC = tU * (o.testPriceCents - o.costCents);
  const pct = (a: number, b: number) => (a > 0 ? Math.round(((b - a) / a) * 100) : null);
  const unitsChangePct = pct(bU, tU);
  const contribChangePct = pct(bC, tC);
  let recommendation: Verdict["recommendation"];
  let reason: string;
  if (o.testDays < 5 || o.testUnits < 10) {
    recommendation = "too_early";
    reason = `Only ${Math.floor(o.testDays)} day${Math.floor(o.testDays) === 1 ? "" : "s"} and ${o.testUnits} sold so far — give it at least 5 days and 10 sales before deciding.`;
  } else if (o.baselineUnits === 0) {
    recommendation = tC > 0 ? "keep" : "revert";
    reason = "No sales in the window before, so there's no baseline — judge the test on its own: " + (tC > 0 ? "it's contributing." : "it isn't contributing.");
  } else if (tC > bC) {
    recommendation = "keep";
    reason = `Contribution per day went from $${(bC / 100).toFixed(2)} to $${(tC / 100).toFixed(2)}${unitsChangePct != null && unitsChangePct < 0 ? ` even though units fell ${Math.abs(unitsChangePct)}%` : ""}. The new price earns more.`;
  } else {
    recommendation = "revert";
    reason = `Contribution per day went from $${(bC / 100).toFixed(2)} to $${(tC / 100).toFixed(2)}${unitsChangePct != null ? ` (units ${unitsChangePct >= 0 ? "+" : ""}${unitsChangePct}%)` : ""}. The old price earned more.`;
  }
  return { baselineUnitsPerDay: bU, testUnitsPerDay: tU, unitsChangePct, baselineContribPerDay: Math.round(bC), testContribPerDay: Math.round(tC), contribChangePct, recommendation, reason };
}
