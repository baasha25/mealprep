import { describe, it, expect } from "vitest";
import { nounsFor, countNoun, isNounKey } from "./nouns";

describe("nouns", () => {
  it("defaults to meals and handles irregular plurals", () => {
    expect(nounsFor(null)).toMatchObject({ one: "meal", many: "meals", One: "Meal", Many: "Meals" });
    expect(nounsFor("nope").key).toBe("meal");
    expect(nounsFor("loaf")).toMatchObject({ one: "loaf", many: "loaves" });
    expect(nounsFor("BOX ")).toMatchObject({ many: "boxes" });
  });
  it("counts correctly", () => {
    const b = nounsFor("bottle");
    expect(countNoun(1, b)).toBe("1 bottle");
    expect(countNoun(3, b)).toBe("3 bottles");
    expect(countNoun(0, b)).toBe("0 bottles");
    expect(isNounKey("pouch")).toBe(true);
    expect(isNounKey("widget")).toBe(false);
  });
});
