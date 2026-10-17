// Storefront search presence — pure helpers (tested, no DB).
//
// What a kitchen gets for free: a <title>/description Google and link previews
// can use, a canonical URL (the kitchen's own domain when it's live), JSON-LD
// that describes the kitchen and every meal with price, nutrition and verified
// ratings, a per-kitchen sitemap and robots file. Nothing here is marketing
// copy — it is the kitchen's own menu, described in the vocabulary search
// engines read (schema.org FoodEstablishment / MenuItem / Product).

export const PRICE_CURRENCY = "CAD";
const DESCRIPTION_MAX = 160;

export type SeoKitchen = {
  name: string;
  logoUrl?: string | null;
  tagline?: string | null;
  description?: string | null;
  serviceArea?: string | null;
};

export type SeoReview = { name: string; rating: number; comment: string; date: string; reply?: string | null };

export type SeoMeal = {
  id: string;
  name: string;
  description: string | null;
  diet: string | null;
  priceCents: number;
  imageUrl: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  ratingAvg: number;
  ratingCount: number;
  reviews: SeoReview[];
};

/** Cut to a search-snippet length at a word boundary, with an ellipsis. */
export function truncate(text: string, max = DESCRIPTION_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > max * 0.6 ? cut.slice(0, atWord) : cut).replace(/[,;:\-–—]$/, "")}…`;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** "<Kitchen> · Meal prep in <area>, delivered" — the storefront <title>. */
export function storeTitle(k: SeoKitchen): string {
  const area = k.serviceArea?.trim();
  return `${k.name} · Meal prep${area ? ` in ${area}` : ""}, delivered`;
}

/** The kitchen's own description when set; otherwise one written from its facts. */
export function storeDescription(
  k: SeoKitchen,
  facts: { mealCount: number; deliveryDaysLabel?: string | null; pickup?: boolean },
): string {
  const own = k.description?.trim();
  if (own) return truncate(own);
  const area = k.serviceArea?.trim();
  const n = facts.mealCount;
  const choose = n > 0 ? `Choose from ${n} meal${n === 1 ? "" : "s"}, one-time or as a weekly plan,` : "Order one-time or as a weekly plan,";
  const how = facts.deliveryDaysLabel
    ? `delivered ${facts.deliveryDaysLabel}${facts.pickup ? " or ready for pickup" : ""}.`
    : facts.pickup
      ? "delivered or ready for pickup."
      : "delivered to your door.";
  return truncate(`${k.name} makes fresh, chef-prepared meals${area ? ` in ${area}` : ""}. ${choose} ${how} Order online.`);
}

export function mealTitle(m: Pick<SeoMeal, "name">, k: SeoKitchen): string {
  return `${m.name} · ${k.name}`;
}

/** Meal description for search/link previews: the chef's words first, then the facts. */
export function mealDescription(m: SeoMeal, k: SeoKitchen): string {
  const area = k.serviceArea?.trim();
  const facts = `${m.calories} cal, ${m.proteinG}g protein. ${dollars(m.priceCents)} from ${k.name}${area ? ` in ${area}` : ""}.`;
  const own = m.description?.trim();
  if (!own) return truncate(`${m.name}${m.diet ? ` (${m.diet})` : ""} — ${facts}`);
  const combined = `${own.replace(/[.!]?$/, ".")} ${facts}`;
  return combined.length <= DESCRIPTION_MAX ? combined : truncate(own);
}

// schema.org RestrictedDiet values we can honestly claim from a diet tag.
// (Keto / Low Carb / High Protein have no schema.org term, so we add none.)
const DIET_SCHEMA: Record<string, string> = {
  "plant-based": "https://schema.org/VeganDiet",
  vegan: "https://schema.org/VeganDiet",
  vegetarian: "https://schema.org/VegetarianDiet",
};

function nutritionJsonLd(m: SeoMeal) {
  if (!m.calories && !m.proteinG && !m.carbsG && !m.fatG) return undefined;
  return {
    "@type": "NutritionInformation",
    calories: `${m.calories} calories`,
    proteinContent: `${m.proteinG} g`,
    carbohydrateContent: `${m.carbsG} g`,
    fatContent: `${m.fatG} g`,
  };
}

function ratingJsonLd(m: SeoMeal) {
  if (m.ratingCount <= 0) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: Number(m.ratingAvg.toFixed(1)),
    reviewCount: m.ratingCount,
    bestRating: 5,
    worstRating: 1,
  };
}

function reviewsJsonLd(m: SeoMeal) {
  if (!m.reviews.length) return undefined;
  return m.reviews.slice(0, 3).map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.name },
    datePublished: r.date,
    reviewBody: r.comment,
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
  }));
}

function offerJsonLd(m: SeoMeal, url: string) {
  return {
    "@type": "Offer",
    url,
    price: (m.priceCents / 100).toFixed(2),
    priceCurrency: PRICE_CURRENCY,
    availability: "https://schema.org/InStock",
  };
}

/** One menu item inside the kitchen's FoodEstablishment graph. */
export function menuItemJsonLd(m: SeoMeal, url: string) {
  const diet = m.diet ? DIET_SCHEMA[m.diet.toLowerCase()] : undefined;
  return strip({
    "@type": "MenuItem",
    name: m.name,
    description: m.description ?? undefined,
    url,
    image: m.imageUrl ?? undefined,
    offers: offerJsonLd(m, url),
    nutrition: nutritionJsonLd(m),
    suitableForDiet: diet,
    aggregateRating: ratingJsonLd(m),
  });
}

/** The storefront's JSON-LD: the kitchen as a FoodEstablishment with its menu. */
export function storeJsonLd(k: SeoKitchen, origin: string, meals: SeoMeal[], mealUrl: (id: string) => string) {
  const rated = meals.filter((m) => m.ratingCount > 0);
  const totalReviews = rated.reduce((s, m) => s + m.ratingCount, 0);
  const avg = totalReviews ? rated.reduce((s, m) => s + m.ratingAvg * m.ratingCount, 0) / totalReviews : 0;
  return strip({
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: k.name,
    url: origin,
    image: k.logoUrl ?? meals.find((m) => m.imageUrl)?.imageUrl ?? undefined,
    description: k.tagline?.trim() || k.description?.trim() || undefined,
    areaServed: k.serviceArea?.trim() || undefined,
    servesCuisine: "Meal prep",
    priceRange: priceRange(meals),
    aggregateRating: totalReviews
      ? { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: totalReviews, bestRating: 5, worstRating: 1 }
      : undefined,
    hasMenu: meals.length
      ? {
          "@type": "Menu",
          name: `${k.name} menu`,
          hasMenuSection: [{ "@type": "MenuSection", name: "Meals", hasMenuItem: meals.map((m) => menuItemJsonLd(m, mealUrl(m.id))) }],
        }
      : undefined,
  });
}

/** A meal page's JSON-LD: a Product (what Google's price/rating rich results read). */
export function mealProductJsonLd(m: SeoMeal, k: SeoKitchen, url: string) {
  return strip({
    "@context": "https://schema.org",
    "@type": "Product",
    name: m.name,
    description: m.description ?? undefined,
    image: m.imageUrl ?? undefined,
    url,
    brand: { "@type": "Brand", name: k.name },
    category: "Prepared meal",
    offers: offerJsonLd(m, url),
    aggregateRating: ratingJsonLd(m),
    review: reviewsJsonLd(m),
    additionalProperty: nutritionJsonLd(m)
      ? [
          { "@type": "PropertyValue", name: "Calories", value: m.calories },
          { "@type": "PropertyValue", name: "Protein (g)", value: m.proteinG },
          { "@type": "PropertyValue", name: "Carbs (g)", value: m.carbsG },
          { "@type": "PropertyValue", name: "Fat (g)", value: m.fatG },
        ]
      : undefined,
  });
}

/** "$" / "$$" from the median meal price — the coarse schema.org priceRange. */
export function priceRange(meals: Pick<SeoMeal, "priceCents">[]): string | undefined {
  if (!meals.length) return undefined;
  const sorted = meals.map((m) => m.priceCents).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median < 1200 ? "$" : median < 2000 ? "$$" : "$$$";
}

/** Serialize a sitemap. lastmod is ISO date (YYYY-MM-DD) when known. */
export function sitemapXml(urls: { loc: string; lastmod?: string | null; priority?: number }[]): string {
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}${
          u.priority != null ? `<priority>${u.priority.toFixed(1)}</priority>` : ""
        }</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** robots.txt for one storefront (on its own domain): index the menu, not the account. */
export function storeRobotsTxt(sitemapUrl: string, indexable: boolean): string {
  if (!indexable) return "User-agent: *\nDisallow: /\n";
  return ["User-agent: *", "Allow: /", "Disallow: /account", "Disallow: /success", "Disallow: /subscribed", "Disallow: /catering/", "", `Sitemap: ${sitemapUrl}`, ""].join("\n");
}

/** Embed JSON-LD safely inside a <script> (no </script> or HTML-comment breakouts). */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Drop undefined fields so the JSON-LD stays clean. */
function strip<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}
