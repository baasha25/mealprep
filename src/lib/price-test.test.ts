import { describe, it, expect } from "vitest";
import { experimentWindows, experimentVerdict } from "./price-test";

describe("price test", () => {
  it("builds a same-length baseline window and clamps the test window to now", () => {
    const start = new Date("2026-11-01T00:00:00Z"), end = new Date("2026-11-15T00:00:00Z");
    const w = experimentWindows(start, end, new Date("2026-11-08T00:00:00Z"));
    expect(w.plannedDays).toBe(14);
    expect(w.baseline.from.toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(w.test.days).toBe(7);
    expect(experimentWindows(start, end, new Date("2026-12-01T00:00:00Z")).test.days).toBe(14);
  });
  it("is too early with little data, keeps when contribution/day rises, reverts when it falls", () => {
    const base = { baselineDays: 14, basePriceCents: 1250, testPriceCents: 1400, costCents: 500 };
    expect(experimentVerdict({ ...base, baselineUnits: 140, testUnits: 4, testDays: 2 }).recommendation).toBe("too_early");
    // 10/day at $12.50 → 7.50 contrib ×10 = 75/day; test 9/day at $14 → 9×9 = 81/day → keep.
    const keep = experimentVerdict({ ...base, baselineUnits: 140, testUnits: 63, testDays: 7 });
    expect(keep.recommendation).toBe("keep");
    expect(keep.unitsChangePct).toBe(-10);
    expect(keep.contribChangePct).toBe(8);
    // test 6/day → 54/day → revert.
    expect(experimentVerdict({ ...base, baselineUnits: 140, testUnits: 42, testDays: 7 }).recommendation).toBe("revert");
    // no baseline: judged on its own.
    expect(experimentVerdict({ ...base, baselineUnits: 0, testUnits: 20, testDays: 7 }).recommendation).toBe("keep");
  });
});
