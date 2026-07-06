import { describe, it, expect } from "vitest";
import { summarizeRatings, starParts } from "./reviews";

describe("summarizeRatings", () => {
  it("averages and counts, rounded to 1 decimal", () => {
    expect(summarizeRatings([5, 4, 4])).toEqual({ avg: 4.3, count: 3 });
    expect(summarizeRatings([5, 5])).toEqual({ avg: 5, count: 2 });
  });
  it("empty → zeros", () => {
    expect(summarizeRatings([])).toEqual({ avg: 0, count: 0 });
  });
});

describe("starParts", () => {
  it("splits into full/half/empty", () => {
    expect(starParts(4.3)).toEqual({ full: 4, half: false, empty: 1 });
    expect(starParts(4.5)).toEqual({ full: 4, half: true, empty: 0 });
    expect(starParts(3.7)).toEqual({ full: 3, half: true, empty: 1 });
    expect(starParts(0)).toEqual({ full: 0, half: false, empty: 5 });
  });
  it("clamps out-of-range", () => {
    expect(starParts(6).full).toBe(5);
  });
});
