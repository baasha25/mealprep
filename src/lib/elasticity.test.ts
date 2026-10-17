import { describe, it, expect } from "vitest";
import { priceChangePct, expectedVolumeChangePct, thresholdWarning, elasticityAdvice, PRESETS } from "./elasticity";

describe("elasticity guidance", () => {
  it("price change and expected volume at the published average", () => {
    expect(Math.round(priceChangePct(1400, 2072))).toBe(48);
    expect(expectedVolumeChangePct(48, 0.8)).toBe(-38);
    expect(expectedVolumeChangePct(10, 0.5)).toBe(-5);
    expect(expectedVolumeChangePct(-10, 1.2)).toBe(12);
    expect(expectedVolumeChangePct(500, 1.2)).toBe(-95); // clamped
  });
  it("thresholds: <5% quiet, 5–10% noticeable, >10% big, whole-dollar crossing flagged", () => {
    expect(thresholdWarning(1400, 1450)).toBe("none");
    expect(thresholdWarning(1400, 1480)).toBe("noticeable");
    expect(thresholdWarning(1499, 1575)).toBe("round-number");
    expect(thresholdWarning(1400, 1600)).toBe("big");
    expect(thresholdWarning(1400, 1300)).toBe("none");
  });
  it("advice compares expected loss to affordable loss", () => {
    const typical = PRESETS[1].label;
    expect(elasticityAdvice({ priceChange: 48, expectedVolume: -38, affordableLoss: 25, presetLabel: typical }).tone).toBe("bad");
    expect(elasticityAdvice({ priceChange: 10, expectedVolume: -8, affordableLoss: 25, presetLabel: typical }).tone).toBe("good");
    expect(elasticityAdvice({ priceChange: 20, expectedVolume: -16, affordableLoss: 20, presetLabel: typical }).tone).toBe("caution");
    expect(elasticityAdvice({ priceChange: -10, expectedVolume: 8, affordableLoss: null, presetLabel: typical }).tone).toBe("neutral");
  });
});
