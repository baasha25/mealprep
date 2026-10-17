// Nearby-prices intelligence: fetch a competitor's public menu prices, match
// their items to the kitchen's meals by name, and summarise where the kitchen
// sits. Pure helpers are exported for tests; `fetchCompetitorMenu` does the IO.
//
// Data policy: we read only what the store publishes to every visitor (item
// name, listed price, a link, a portion if stated) from structured public
// endpoints — Shopify's products.json and WooCommerce's Store API. No
// descriptions, no photos, no scraping of rendered pages, and never another
// PrepFlow tenant's prices.

export type FetchedItem = { externalId: string; name: string; priceCents: number; url: string | null; portion: string | null };
export type FetchResult =
  | { ok: true; platform: "shopify" | "woocommerce"; items: FetchedItem[]; storeName: string | null }
  | { ok: false; platform: "unsupported" | "error"; error: string };

const UA = "PrepFlowPriceWatch/1.0 (+https://prepflow.ca; public menu prices only)";

/** Normalise a host or URL the owner typed into a bare domain. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** Grab a stated portion like "450 g", "12 oz", "400g" from a name. */
export function portionFrom(text: string): string | null {
  const m = text.match(/(\d{2,4})\s?(g|grams|oz|ml)\b/i);
  return m ? `${m[1]} ${m[2].toLowerCase()}` : null;
}

/* ─────────────── parsers (pure) ─────────────── */

type ShopifyJson = { products?: { id: number | string; title: string; handle?: string; variants?: { price: string | number; title?: string; grams?: number }[]; product_type?: string }[] };

export function parseShopify(json: unknown, domain: string): FetchedItem[] {
  const d = json as ShopifyJson;
  if (!d || !Array.isArray(d.products)) return [];
  const out: FetchedItem[] = [];
  for (const p of d.products) {
    const v = p.variants?.[0];
    if (!v) continue;
    const price = Math.round(Number(v.price) * 100);
    if (!Number.isFinite(price) || price <= 0) continue;
    const grams = v.grams && v.grams > 0 ? `${v.grams} g` : null;
    out.push({ externalId: String(p.id), name: p.title.trim(), priceCents: price, url: p.handle ? `https://${domain}/products/${p.handle}` : null, portion: grams ?? portionFrom(p.title) });
  }
  return out;
}

type WooJson = { id: number | string; name: string; permalink?: string; prices?: { price: string; currency_minor_unit?: number } }[];

export function parseWoo(json: unknown): FetchedItem[] {
  const d = json as WooJson;
  if (!Array.isArray(d)) return [];
  const out: FetchedItem[] = [];
  for (const p of d) {
    const minor = p.prices?.currency_minor_unit ?? 2;
    const raw = Number(p.prices?.price);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const priceCents = Math.round(raw / Math.pow(10, minor) * 100);
    out.push({ externalId: String(p.id), name: String(p.name).replace(/<[^>]+>/g, "").trim(), priceCents, url: p.permalink ?? null, portion: portionFrom(String(p.name)) });
  }
  return out;
}

/* ─────────────── IO ─────────────── */

async function getJson(url: string, timeoutMs = 12000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!/json/i.test(ct)) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Try the structured public endpoints in order. */
export async function fetchCompetitorMenu(domain: string): Promise<FetchResult> {
  const shop = await getJson(`https://${domain}/products.json?limit=250`);
  if (shop && typeof shop === "object" && Array.isArray((shop as ShopifyJson).products)) {
    const items = parseShopify(shop, domain);
    return { ok: true, platform: "shopify", items, storeName: null };
  }
  const woo = await getJson(`https://${domain}/wp-json/wc/store/v1/products?per_page=100`);
  if (Array.isArray(woo)) {
    return { ok: true, platform: "woocommerce", items: parseWoo(woo), storeName: null };
  }
  return { ok: false, platform: "unsupported", error: "This site doesn't publish its menu in a format we can read yet (Shopify and WooCommerce stores work today)." };
}

/* ─────────────── matching (pure) ─────────────── */

const STOP = new Set(["and", "with", "the", "a", "of", "in", "on", "&", "meal", "prep", "bowl", "plate", "box", "pack", "regular", "large", "small", "classic", "fresh", "healthy", "style", "homemade", "signature", "our"]);
const PROTEINS = ["chicken", "beef", "steak", "salmon", "shrimp", "prawn", "tofu", "turkey", "pork", "lamb", "fish", "cod", "tuna", "egg", "vegan", "veggie", "vegetable", "lentil", "chickpea", "paneer", "tempeh"];

export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(ies|es|s)$/, (m) => (m === "ies" ? "y" : "")))
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** 0–100 similarity between a kitchen meal name and a competitor item name. */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const pa = PROTEINS.find((p) => ta.has(p)), pb = PROTEINS.find((p) => tb.has(p));
  let score = jaccard;
  if (pa && pb) score += pa === pb ? 0.25 : -0.35; // same protein helps a lot; different protein sinks it
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

export const SUGGEST_MIN = 34;

/** Bulk / family / multi-pack listings aren't comparable to a single plate. */
export const BULK_RE = /\b(bulk|family|catering|party|tray|box of|\d+\s?-?\s?pack|\d+\s?x\b|\d+\s?meals?\b|half pan|full pan|per lb|per kg|kg\b)\b/i;
export function isBulkListing(name: string): boolean {
  return BULK_RE.test(name);
}

/** Top suggestions for one meal across all competitor items. */
export function suggestFor<T extends { id: string; name: string }>(mealName: string, items: T[], limit = 3): { item: T; score: number }[] {
  return items
    .filter((item) => !isBulkListing(item.name))
    .map((item) => ({ item, score: similarity(mealName, item.name) }))
    .filter((x) => x.score >= SUGGEST_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ─────────────── comparison (pure) ─────────────── */

export type Comparison = { count: number; minCents: number; maxCents: number; medianCents: number; vsMedianPct: number | null };

export function compare(yourPriceCents: number, compPrices: number[]): Comparison {
  const ps = compPrices.filter((p) => p > 0).sort((a, b) => a - b);
  if (ps.length === 0) return { count: 0, minCents: 0, maxCents: 0, medianCents: 0, vsMedianPct: null };
  const mid = Math.floor(ps.length / 2);
  const median = ps.length % 2 ? ps[mid] : Math.round((ps[mid - 1] + ps[mid]) / 2);
  return { count: ps.length, minCents: ps[0], maxCents: ps[ps.length - 1], medianCents: median, vsMedianPct: median > 0 ? Math.round(((yourPriceCents - median) / median) * 100) : null };
}

/** Plain-English read of a comparison. */
export function positionLabel(vsMedianPct: number | null): { label: string; tone: "under" | "inline" | "over" | "none" } {
  if (vsMedianPct == null) return { label: "No confirmed matches yet", tone: "none" };
  if (vsMedianPct <= -8) return { label: `${Math.abs(vsMedianPct)}% under nearby`, tone: "under" };
  if (vsMedianPct >= 8) return { label: `${vsMedianPct}% over nearby`, tone: "over" };
  return { label: "In line with nearby", tone: "inline" };
}
