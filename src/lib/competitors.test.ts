import { describe, it, expect } from "vitest";
import { normalizeDomain, parseShopify, parseWoo, similarity, suggestFor, compare, positionLabel, portionFrom, isBulkListing } from "./competitors";

describe("competitor price helpers", () => {
  it("normalises what an owner types into a domain", () => {
    expect(normalizeDomain("https://www.powerkitchen.ca/collections/all")).toBe("powerkitchen.ca");
    expect(normalizeDomain("PowerKitchen.ca")).toBe("powerkitchen.ca");
    expect(normalizeDomain("not a domain")).toBeNull();
  });
  it("parses Shopify products.json and WooCommerce store API shapes", () => {
    const s = parseShopify({ products: [{ id: 1, title: "Honey Mustard Chicken (450g)", handle: "hmc", variants: [{ price: "18.50", grams: 0 }] }, { id: 2, title: "Gift card", variants: [{ price: "0" }] }] }, "x.com");
    expect(s).toEqual([{ externalId: "1", name: "Honey Mustard Chicken (450g)", priceCents: 1850, url: "https://x.com/products/hmc", portion: "450 g" }]);
    const w = parseWoo([{ id: 9, name: "Chicken Beyti Meatballs", permalink: "https://y.ca/p/9", prices: { price: "1795", currency_minor_unit: 2 } }]);
    expect(w[0].priceCents).toBe(1795); expect(w[0].url).toBe("https://y.ca/p/9");
    expect(portionFrom("Steak 12 oz")).toBe("12 oz");
  });
  it("matches on shared words and the same protein; different proteins sink", () => {
    expect(similarity("Grilled Chicken & Quinoa", "Grilled Chicken Quinoa Bowl")).toBeGreaterThanOrEqual(80);
    expect(similarity("Honey Garlic Chicken", "Honey Mustard Chicken")).toBeGreaterThanOrEqual(45);
    expect(similarity("Salmon & Sweet Potato", "Steak & Sweet Potato")).toBeLessThan(34);
    expect(similarity("Shrimp Cauli-Rice", "Cajun Chickpea")).toBe(0);
  });
  it("suggests the best few above the threshold", () => {
    const items = [{ id: "a", name: "Teriyaki Chicken Rice" }, { id: "b", name: "Chicken Teriyaki Bowl" }, { id: "c", name: "Vegan Meatballs" }];
    const s = suggestFor("Teriyaki Chicken", items);
    expect(s.map((x) => x.item.id).sort()).toEqual(["a", "b"]);
  });
  it("compares against the median and labels the position", () => {
    const c = compare(1400, [1350, 1600, 1500, 1785, 1450]);
    expect(c).toMatchObject({ count: 5, minCents: 1350, maxCents: 1785, medianCents: 1500, vsMedianPct: -7 });
    expect(positionLabel(-7).tone).toBe("inline");
    expect(positionLabel(-12)).toEqual({ label: "12% under nearby", tone: "under" });
    expect(positionLabel(15).tone).toBe("over");
    expect(compare(1400, []).count).toBe(0);
  });
});

describe("bulk listings are excluded from suggestions", () => {
  it("skips family packs, bulk and per-kg items", () => {
    expect(isBulkListing("Bulk - Persian Style Chicken")).toBe(true);
    expect(isBulkListing("Family Pack Lasagna (6 meals)")).toBe(true);
    expect(isBulkListing("Chicken breast per kg")).toBe(true);
    expect(isBulkListing("Custom - Peri Peri Chicken")).toBe(false);
    const s = suggestFor("Persian Chicken", [{ id: "a", name: "Bulk - Persian Style Chicken" }, { id: "b", name: "Custom - Persian Style Chicken" }]);
    expect(s.map((x) => x.item.id)).toEqual(["b"]);
  });
});
