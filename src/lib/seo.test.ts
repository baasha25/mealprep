import { describe, it, expect } from "vitest";
import {
  truncate,
  storeTitle,
  storeDescription,
  mealTitle,
  mealDescription,
  storeJsonLd,
  mealProductJsonLd,
  menuItemJsonLd,
  priceRange,
  sitemapXml,
  storeRobotsTxt,
  jsonLdScript,
  type SeoMeal,
} from "./seo";

const kitchen = { name: "Balance Kitchen", serviceArea: "Durham Region", logoUrl: null, tagline: null, description: null };

const meal = (over: Partial<SeoMeal> = {}): SeoMeal => ({
  id: "m1",
  name: "Chicken & Rice Bowl",
  description: "Grilled chicken, jasmine rice, roasted peppers.",
  diet: "High Protein",
  priceCents: 1350,
  imageUrl: "https://res.cloudinary.com/x/image/upload/v1/a.jpg",
  calories: 520,
  proteinG: 42,
  carbsG: 48,
  fatG: 14,
  allergens: [],
  ratingAvg: 4.6,
  ratingCount: 12,
  reviews: [{ name: "Sam", rating: 5, comment: "So good <3", date: "2026-10-01" }],
  ...over,
});

describe("titles and descriptions", () => {
  it("builds a local-search title with the service area", () => {
    expect(storeTitle(kitchen)).toBe("Balance Kitchen · Meal prep in Durham Region, delivered");
    expect(storeTitle({ ...kitchen, serviceArea: "" })).toBe("Balance Kitchen · Meal prep, delivered");
    expect(mealTitle(meal(), kitchen)).toBe("Chicken & Rice Bowl · Balance Kitchen");
  });
  it("writes a store description from facts when the kitchen has not", () => {
    const d = storeDescription(kitchen, { mealCount: 14, deliveryDaysLabel: "Mondays & Thursdays", pickup: true });
    expect(d).toContain("Balance Kitchen makes fresh, chef-prepared meals in Durham Region.");
    expect(d).toContain("14 meals");
    expect(d).toContain("Mondays & Thursdays");
    expect(d.length).toBeLessThanOrEqual(160);
  });
  it("prefers the kitchen's own description, trimmed to snippet length", () => {
    const long = "x".repeat(50) + " " + "word ".repeat(60);
    const d = storeDescription({ ...kitchen, description: long }, { mealCount: 3 });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith("…")).toBe(true);
    expect(storeDescription({ ...kitchen, description: "Short and sweet." }, { mealCount: 3 })).toBe("Short and sweet.");
  });
  it("meal description = chef's words + facts, falling back to the chef's words alone", () => {
    expect(mealDescription(meal(), kitchen)).toBe(
      "Grilled chicken, jasmine rice, roasted peppers. 520 cal, 42g protein. $13.50 from Balance Kitchen in Durham Region.",
    );
    const long = meal({ description: "Lovely ".repeat(30).trim() });
    expect(mealDescription(long, kitchen).length).toBeLessThanOrEqual(160);
    expect(mealDescription(meal({ description: null }), kitchen)).toContain("Chicken & Rice Bowl (High Protein) — 520 cal");
  });
  it("truncate cuts at a word and never exceeds the max", () => {
    expect(truncate("one two three four five six", 14)).toBe("one two three…");
    expect(truncate("short", 14)).toBe("short");
  });
});

describe("JSON-LD", () => {
  it("describes the kitchen as a FoodEstablishment with its menu and a blended rating", () => {
    const meals = [meal(), meal({ id: "m2", name: "Tofu Bowl", diet: "Plant-Based", priceCents: 1200, ratingAvg: 4.0, ratingCount: 4, reviews: [] })];
    const ld = storeJsonLd(kitchen, "https://order.balance.ca", meals, (id) => `https://order.balance.ca/meal/${id}`) as Record<string, unknown>;
    expect(ld["@type"]).toBe("FoodEstablishment");
    expect(ld.areaServed).toBe("Durham Region");
    expect(ld.priceRange).toBe("$$");
    const agg = ld.aggregateRating as { ratingValue: number; reviewCount: number };
    expect(agg.reviewCount).toBe(16);
    expect(agg.ratingValue).toBeCloseTo(4.45, 1); // (4.6*12 + 4.0*4) / 16
    const menu = ld.hasMenu as { hasMenuSection: { hasMenuItem: Record<string, unknown>[] }[] };
    const items = menu.hasMenuSection[0].hasMenuItem;
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe("https://order.balance.ca/meal/m1");
    expect(items[1].suitableForDiet).toBe("https://schema.org/VeganDiet");
    expect(items[0].suitableForDiet).toBeUndefined(); // no schema.org term for High Protein — claim nothing
  });
  it("omits ratings, nutrition and image when there are none", () => {
    const ld = menuItemJsonLd(meal({ ratingCount: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, imageUrl: null }), "u") as Record<string, unknown>;
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.nutrition).toBeUndefined();
    expect(ld.image).toBeUndefined();
    expect((ld.offers as { price: string }).price).toBe("13.50");
  });
  it("meal page is a Product with offer, rating, reviews and macros", () => {
    const ld = mealProductJsonLd(meal(), kitchen, "https://prepflow.ca/store/balance/meal/m1") as Record<string, unknown>;
    expect(ld["@type"]).toBe("Product");
    expect((ld.brand as { name: string }).name).toBe("Balance Kitchen");
    expect((ld.offers as { priceCurrency: string }).priceCurrency).toBe("CAD");
    expect((ld.review as unknown[]).length).toBe(1);
    expect((ld.additionalProperty as { value: number }[])[1].value).toBe(42);
  });
  it("script serialization cannot break out of the tag", () => {
    const s = jsonLdScript({ a: "</script><b>&" });
    expect(s).not.toContain("</script>");
    expect(s).not.toContain("<b>");
    expect(JSON.parse(s)).toEqual({ a: "</script><b>&" });
  });
  it("priceRange follows the median meal price", () => {
    expect(priceRange([{ priceCents: 999 }, { priceCents: 1100 }])).toBe("$");
    expect(priceRange([{ priceCents: 2400 }])).toBe("$$$");
    expect(priceRange([])).toBeUndefined();
  });
});

describe("sitemap + robots", () => {
  it("writes a valid urlset with escaped locs and ISO dates", () => {
    const xml = sitemapXml([
      { loc: "https://order.balance.ca", priority: 1 },
      { loc: "https://order.balance.ca/meal/a&b", lastmod: "2026-10-16T12:00:00.000Z", priority: 0.8 },
    ]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://order.balance.ca/meal/a&amp;b</loc><lastmod>2026-10-16</lastmod><priority>0.8</priority>");
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });
  it("robots allows the menu, hides account pages, and blocks demo tenants entirely", () => {
    const r = storeRobotsTxt("https://order.balance.ca/sitemap.xml", true);
    expect(r).toContain("Allow: /");
    expect(r).toContain("Disallow: /account");
    expect(r).toContain("Sitemap: https://order.balance.ca/sitemap.xml");
    expect(storeRobotsTxt("x", false)).toBe("User-agent: *\nDisallow: /\n");
  });
});
