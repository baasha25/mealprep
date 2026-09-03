import { describe, it, expect } from "vitest";
import { labelZpl, batchZpl, type ZplLabel } from "./zpl";

const base: ZplLabel = {
  businessName: "Greenleaf Kitchen",
  name: "Grilled Chicken & Quinoa",
  calories: 540,
  proteinG: 42,
  carbsG: 45,
  fatG: 12,
  allergens: ["gluten"],
  bestByLabel: "Sep 10, 2026",
  qty: 3,
};

describe("labelZpl", () => {
  it("wraps in ^XA/^XZ and sets width/length for the size", () => {
    const z = labelZpl(base, "4x2");
    expect(z.startsWith("^XA")).toBe(true);
    expect(z.trimEnd().endsWith("^XZ")).toBe(true);
    expect(z).toContain("^PW812");
    expect(z).toContain("^LL406");
  });
  it("includes the meal name, macros, best-by and allergens", () => {
    const z = labelZpl(base);
    expect(z).toContain("Grilled Chicken & Quinoa");
    expect(z).toContain("540 cal  42P  45C  12F");
    expect(z).toContain("Best by Sep 10, 2026");
    expect(z).toContain("Contains: gluten");
  });
  it("uses ^PQ for the print quantity", () => {
    expect(labelZpl(base)).toContain("^PQ3");
    expect(labelZpl({ ...base, qty: 500 })).toContain("^PQ500");
  });
  it("omits the allergen line when there are none", () => {
    expect(labelZpl({ ...base, allergens: [] })).not.toContain("Contains:");
  });
  it("strips ZPL control chars from user text", () => {
    const z = labelZpl({ ...base, name: "Beef ^Ribs~ \\ Rice" });
    expect(z).not.toMatch(/FDBeef \^/);
    expect(z).toContain("Beef  Ribs");
  });
  it("2x1 uses the smaller canvas", () => {
    const z = labelZpl(base, "2x1");
    expect(z).toContain("^PW406");
    expect(z).toContain("^LL203");
  });
  it("clamps qty to at least 1", () => {
    expect(labelZpl({ ...base, qty: 0 })).toContain("^PQ1");
  });
});

describe("batchZpl", () => {
  it("emits one block per meal and skips zero-qty", () => {
    const out = batchZpl([base, { ...base, name: "Salmon", qty: 0 }, { ...base, name: "Tofu", qty: 2 }]);
    expect((out.match(/\^XA/g) ?? []).length).toBe(2); // base + Tofu, not the qty:0 Salmon
    expect(out).not.toContain("Salmon");
    expect(out).toContain("Tofu");
  });
});
