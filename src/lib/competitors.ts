// Nearby-prices intelligence: fetch a competitor's public menu prices, match
// their items to the kitchen's meals by name, and summarise where the kitchen
// sits. Pure helpers are exported for tests; `fetchCompetitorMenu` does the IO.
//
// Data policy: we read only what the store publishes to every visitor (item
// name, listed price, a link, a portion if stated). Exact readers first —
// Shopify's products.json, WooCommerce's Store API, product-page structured
// data, Squarespace's JSON view — then, for app-style storefronts, the page
// text is read by Claude and every price is marked ESTIMATED. No descriptions,
// no photos, robots.txt respected, and never another PrepFlow tenant's prices.

import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import {
  fetchText, mapLimit, parseRobots, isAllowed, sitemapLocs, isSitemapIndex, rankChildSitemaps, pickProductUrls,
  extractJsonLdProducts, squarespaceItems, squarespaceCollections, htmlToText, priceCount, findMenuLinks, renderedFetchUrl,
  decodeEntities, isNonMenuListing,
  type RobotsRules,
} from "@/lib/competitor-readers";
import { extractPricesWithClaude } from "@/lib/competitor-ai";

export type FetchedItem = { externalId: string; name: string; priceCents: number; url: string | null; portion: string | null; estimated?: boolean };
export type ReadMethod = "shopify" | "woocommerce" | "jsonld" | "squarespace" | "ai" | "ai-rendered";
export type FetchResult =
  | { ok: true; platform: ReadMethod; items: FetchedItem[]; storeName: string | null; note?: string | null }
  | { ok: false; platform: "unsupported" | "error"; error: string };

/** Owner-facing label for how a competitor was read. */
export const READ_METHOD_LABEL: Record<string, string> = {
  shopify: "Shopify feed",
  woocommerce: "WooCommerce feed",
  jsonld: "product pages",
  squarespace: "Squarespace feed",
  ai: "AI-read · estimated",
  "ai-rendered": "AI-read · estimated",
  unsupported: "can't read yet",
};
export function isEstimatedMethod(platform: string | null | undefined): boolean {
  return platform === "ai" || platform === "ai-rendered";
}

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
    out.push({ externalId: String(p.id), name: decodeEntities(p.title), priceCents: price, url: p.handle ? `https://${domain}/products/${p.handle}` : null, portion: grams ?? portionFrom(p.title) });
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
    out.push({ externalId: String(p.id), name: decodeEntities(String(p.name).replace(/<[^>]+>/g, "")), priceCents, url: p.permalink ?? null, portion: portionFrom(String(p.name)) });
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

/**
 * Read a competitor's menu. Exact feeds first; then product-page structured
 * data via the sitemap; then Squarespace's JSON view; finally the AI text read
 * (raw HTML, or JS-rendered when the raw page has no prices). `deadlineMs`
 * bounds the whole attempt so a weekly batch can't run away.
 */
export async function fetchCompetitorMenu(domain: string, opts: { deadlineMs?: number; allowAi?: boolean } = {}): Promise<FetchResult> {
  const started = Date.now();
  const left = () => Math.max(1000, (opts.deadlineMs ?? 75_000) - (Date.now() - started));

  const shop = await getJson(`https://${domain}/products.json?limit=250`);
  if (shop && typeof shop === "object" && Array.isArray((shop as ShopifyJson).products)) {
    const items = parseShopify(shop, domain);
    return { ok: true, platform: "shopify", items, storeName: null };
  }
  const woo = await getJson(`https://${domain}/wp-json/wc/store/v1/products?per_page=100`);
  if (Array.isArray(woo)) {
    return { ok: true, platform: "woocommerce", items: parseWoo(woo), storeName: null };
  }

  const base = `https://${domain}`;
  // Home page first: it tells us the site is reachable and gives us menu links.
  const home = await fetchText(base, { timeoutMs: 15_000, browserUa: true });
  if (!home) return { ok: false, platform: "error", error: "Couldn't reach their site (timed out or blocked automated visitors)." };
  if (home.status >= 400) return { ok: false, platform: "error", error: `Their site answered ${home.status}.` };
  const robots = await readRobots(base);
  const okPath = (u: string) => { try { return isAllowed(new URL(u).pathname, robots); } catch { return false; } };

  // 1. Product pages with structured data, discovered through the sitemap.
  //    Capped to ~25 s so a slow sitemap can't starve the page read below.
  //    A real store has many; one or two usually means gift cards or a package,
  //    so we keep them but carry on to the page read.
  let exact: FetchedItem[] = [];
  let exactMethod: ReadMethod = "jsonld";
  const crawlDeadline = Date.now() + Math.min(25_000, left() / 2);
  const crawlLeft = () => Math.max(1500, crawlDeadline - Date.now());
  const productUrls = await discoverProductUrls(base, domain, robots, crawlLeft);
  if (productUrls.length && crawlLeft() > 3000) {
    const pages = await mapLimit(productUrls.filter(okPath).slice(0, 40), 6, (u) => (crawlLeft() > 2000 ? fetchText(u, { timeoutMs: Math.min(8000, crawlLeft()), browserUa: true }) : Promise.resolve(null)));
    exact = clean(dedupe(pages.flatMap((p, i) => (p && p.status === 200 ? extractJsonLdProducts(p.text, productUrls[i]) : []))));
    if (exact.length >= 5) return { ok: true, platform: "jsonld", items: exact, storeName: null };
  }

  // 2. Squarespace JSON view.
  const sq = clean(await readSquarespace(base, okPath));
  if (sq.length >= 5) return { ok: true, platform: "squarespace", items: sq, storeName: null };
  if (sq.length > exact.length) { exact = sq; exactMethod = "squarespace"; }

  // 3. AI read of page text.
  if (opts.allowAi === false || !ANTHROPIC_ENABLED) {
    if (exact.length) return { ok: true, platform: exactMethod, items: exact, storeName: null };
    return { ok: false, platform: "unsupported", error: "This site doesn't publish its menu in a format we can read exactly. AI page reading isn't switched on for this installation yet (needs the Anthropic key)." };
  }
  const links = findMenuLinks(home.text, home.finalUrl, 3).filter(okPath);
  const candidates = [home.finalUrl, ...links.filter((l) => l !== home.finalUrl)].slice(0, 4);
  const fetched = await mapLimit(candidates, 3, async (u) => (u === home.finalUrl ? home : await fetchText(u, { timeoutMs: Math.min(12_000, left()), browserUa: true })));
  let pages = fetched.map((p, i) => ({ url: candidates[i], text: p && p.status === 200 ? htmlToText(p.text) : "" })).filter((p) => p.text);
  let method: ReadMethod = "ai";
  const rawPrices = pages.reduce((n, p) => n + priceCount(p.text), 0);
  if (rawPrices < 3) {
    // App-style storefront: ask a JS-rendering fetcher for the rendered text.
    const rendered = await mapLimit(candidates.slice(0, 2), 2, (u) => fetchText(renderedFetchUrl(u), { timeoutMs: Math.min(40_000, left()), accept: "text/plain", headers: { "x-return-format": "text", ...(process.env.JINA_API_KEY ? { authorization: `Bearer ${process.env.JINA_API_KEY}` } : {}) } }));
    const renderedPages = rendered.map((p, i) => ({ url: candidates[i], text: p && p.status === 200 ? p.text.slice(0, 24_000) : "" })).filter((p) => priceCount(p.text) > 0);
    if (renderedPages.length) { pages = renderedPages; method = "ai-rendered"; }
  }
  if (!pages.length || pages.reduce((n, p) => n + priceCount(p.text), 0) === 0) {
    if (exact.length) return { ok: true, platform: exactMethod, items: exact, storeName: null };
    return { ok: false, platform: "unsupported", error: "Their menu prices don't appear on the public pages (likely shown only after choosing a plan, a postal code or logging in)." };
  }
  try {
    const read = await extractPricesWithClaude(pages, domain);
    const ai = clean(read.items);
    if (ai.length === 0) {
      if (exact.length) return { ok: true, platform: exactMethod, items: exact, storeName: null, note: read.note };
      return { ok: false, platform: "unsupported", error: read.planOnly ? `Only plan or bundle pricing is published, not per-meal prices.${read.note ? ` ${read.note}` : ""}` : read.note || "No individually priced meals found on their public pages." };
    }
    // Exact items win over AI guesses for the same dish name.
    const exactSlugs = new Set(exact.map((i) => i.externalId));
    const merged = [...exact, ...ai.filter((i) => !exactSlugs.has(i.externalId))];
    return { ok: true, platform: method, items: merged, storeName: null, note: read.note };
  } catch (err) {
    console.error("[competitors] AI read failed:", err);
    if (exact.length) return { ok: true, platform: exactMethod, items: exact, storeName: null };
    return { ok: false, platform: "error", error: "The AI read failed this time. Try again in a few minutes." };
  }
}

/** Drop gift cards, deposits, services and anything not priced like a plate. */
function clean(items: FetchedItem[]): FetchedItem[] {
  return items.filter((i) => !isNonMenuListing(i.name, i.priceCents));
}

/* ─────────────── helpers for the non-feed readers ─────────────── */

async function readRobots(base: string): Promise<RobotsRules> {
  const r = await fetchText(`${base}/robots.txt`, { timeoutMs: 6000, accept: "text/plain" });
  return r && r.status === 200 && /user-agent/i.test(r.text) ? parseRobots(r.text) : { disallow: [], allow: [], sitemaps: [] };
}

/** Sitemap(s) → up to 80 product-like URLs on this host, within `leftMs`. */
async function discoverProductUrls(base: string, domain: string, robots: RobotsRules, leftMs: () => number): Promise<string[]> {
  const roots = [...new Set([...robots.sitemaps, `${base}/sitemap.xml`, `${base}/sitemap_index.xml`])];
  const found: string[] = [];
  const opened = new Set<string>();
  const open = async (u: string, depth: number): Promise<void> => {
    if (opened.has(u) || opened.size > 12 || found.length >= 80 || leftMs() < 2500) return;
    opened.add(u);
    const r = await fetchText(u, { timeoutMs: Math.min(8000, leftMs()), accept: "application/xml,text/xml,*/*" });
    if (!r || r.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.text)) return;
    const locs = sitemapLocs(r.text);
    if (isSitemapIndex(r.text)) {
      if (depth >= 2) return;
      for (const child of rankChildSitemaps(locs).slice(0, 6)) await open(child, depth + 1);
      return;
    }
    for (const p of pickProductUrls(locs, domain, 80 - found.length)) found.push(p);
  };
  for (const root of roots) {
    await open(root, 0);
    if (found.length) break;
  }
  return [...new Set(found)].slice(0, 80);
}

async function readSquarespace(base: string, okPath: (u: string) => boolean): Promise<FetchedItem[]> {
  const home = await getJson(`${base}/?format=json`, 9000);
  if (!home || typeof home !== "object" || !("collection" in (home as object))) return [];
  const cols = squarespaceCollections(home).filter((c) => c.typeName === "products" || /shop|menu|meal|store|order/i.test(c.urlId)).slice(0, 4);
  const out: FetchedItem[] = [];
  for (const c of cols) {
    const u = `${base}/${c.urlId}`;
    if (!okPath(u)) continue;
    const json = await getJson(`${u}?format=json`, 9000);
    out.push(...squarespaceItems(json, base));
  }
  return dedupe(out);
}

function dedupe(items: FetchedItem[]): FetchedItem[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.externalId) ? false : (seen.add(i.externalId), true)));
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
