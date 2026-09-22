import { describe, it, expect } from "vitest";
import { resolveSelections, optionsKeyOf, nameWithOptions, picksFromSnapshot, defaultOptionIds } from "./meal-options";

const groups = [
  { id: "g1", name: "Base", minSelect: 1, maxSelect: 1, options: [
    { id: "quinoa", name: "Quinoa", priceDeltaCents: 0, isDefault: true },
    { id: "rice", name: "Brown rice", priceDeltaCents: 0, isDefault: false },
  ] },
  { id: "g2", name: "Protein", minSelect: 1, maxSelect: 1, options: [
    { id: "chicken", name: "Chicken", priceDeltaCents: 0, isDefault: false },
    { id: "tofu", name: "Tofu", priceDeltaCents: -100, isDefault: false },
    { id: "steak", name: "Steak", priceDeltaCents: 350, isDefault: false, active: false },
  ] },
  { id: "g3", name: "Extras", minSelect: 0, maxSelect: 2, options: [
    { id: "avo", name: "Avocado", priceDeltaCents: 150, isDefault: false },
    { id: "egg", name: "Egg", priceDeltaCents: 100, isDefault: false },
  ] },
];

describe("resolveSelections", () => {
  it("applies defaults when nothing is chosen (POS / subscriptions)", () => {
    const r = resolveSelections(groups, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.picks.map((p) => p.optionId)).toEqual(["quinoa", "chicken"]); // default, then first active
    expect(r.priceDeltaCents).toBe(0);
    expect(r.optionsKey).toBe("chicken+quinoa");
  });
  it("prices an explicit configuration and ignores no groups", () => {
    const r = resolveSelections(groups, ["rice", "tofu", "avo", "egg"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.priceDeltaCents).toBe(-100 + 150 + 100);
    expect(nameWithOptions("Bowl", r.picks)).toBe("Bowl (Brown rice · Tofu · Avocado · Egg)");
  });
  it("rejects too many picks in a group", () => {
    const r = resolveSelections([{ ...groups[2], minSelect: 0, maxSelect: 1 }], ["avo", "egg"]);
    expect(r.ok).toBe(false);
  });
  it("rejects inactive / unknown option ids (never price a stale pick)", () => {
    expect(resolveSelections(groups, ["steak"]).ok).toBe(false);
    expect(resolveSelections(groups, ["nope"]).ok).toBe(false);
  });
  it("optional group can be empty; required group can't be", () => {
    const r = resolveSelections(groups, ["quinoa", "chicken"]);
    expect(r.ok && r.picks.length).toBe(2);
    const req = resolveSelections([{ ...groups[0], options: [] }], []);
    expect(req.ok).toBe(false);
  });
});

describe("helpers", () => {
  it("optionsKeyOf is order-independent and de-duped", () => {
    expect(optionsKeyOf(["b", "a", "b"])).toBe("a+b");
    expect(optionsKeyOf([])).toBe("");
  });
  it("picksFromSnapshot tolerates junk", () => {
    expect(picksFromSnapshot(null)).toEqual([]);
    expect(picksFromSnapshot([{ optionId: "x", optionName: "X" }, 5, "no"])).toHaveLength(1);
  });
  it("defaultOptionIds", () => {
    expect(defaultOptionIds(groups)).toEqual(["quinoa", "chicken"]);
  });
});
