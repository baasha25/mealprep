import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Greenleaf Kitchen")).toBe("greenleaf-kitchen");
  });
  it("strips punctuation and collapses separators", () => {
    expect(slugify("  María's Fresh & Fast!! ")).toBe("mar-a-s-fresh-fast");
  });
  it("trims to 40 chars with no trailing hyphen", () => {
    const s = slugify("a".repeat(30) + " " + "b".repeat(30));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("falls back to 'kitchen' when nothing survives", () => {
    expect(slugify("!!!")).toBe("kitchen");
    expect(slugify("   ")).toBe("kitchen");
  });
});
