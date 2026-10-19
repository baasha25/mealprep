// Nearby prices — readers for sites that are NOT Shopify/WooCommerce.
//
// Ladder (cheapest and most exact first):
//   1. Structured data on product pages (JSON-LD Product / MenuItem) found via
//      the site's sitemap — Wix, Square Online, Squarespace, many custom sites.
//      Exact listed prices, no AI.
//   2. Squarespace's `?format=json` collection view. Exact, no AI.
//   3. Page text → Claude (src/lib/competitor-ai.ts). For app-style storefronts
//      (Sprwt, GoPrep, Wix restaurant menus…). When the raw HTML carries no
//      prices we first ask a JS-rendering fetcher for the rendered text. Every
//      price from this path is stored as ESTIMATED and shown with a ≈ mark.
//
// Data policy is unchanged: item names, listed prices, a link, a portion when
// stated. No descriptions, photos, customer data, or other PrepFlow tenants.
// We honour robots.txt Disallow rules for the paths we read.

import type { FetchedItem } from "./competitors";

export const READER_UA = "PrepFlowPriceWatch/1.0 (+https://prepflow.ca; public menu prices only)";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const MAX_BYTES = 2_500_000;

export type Page = { status: number; text: string; finalUrl: string; contentType: string };

/** Fetch a page as text with a timeout, redirect following and a size cap. */
export async function fetchText(url: string, opts: { timeoutMs?: number; accept?: string; browserUa?: boolean; headers?: Record<string, string> } = {}): Promise<Page | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": opts.browserUa ? BROWSER_UA : READER_UA, accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "en-CA,en;q=0.9", ...(opts.headers ?? {}) },
      signal: ctrl.signal,
      redirect: "follow",
    });
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, text: "", finalUrl: res.url || url, contentType: res.headers.get("content-type") ?? "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        chunks.push(value);
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks, total));
    return { status: res.status, text, finalUrl: res.url || url, contentType: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let o = 0;
  for (const c of chunks) {
    const n = Math.min(c.byteLength, out.byteLength - o);
    out.set(c.subarray(0, n), o);
    o += n;
    if (o >= out.byteLength) break;
  }
  return out;
}

/** Run `fn` over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/* ─────────────── robots.txt (pure) ─────────────── */

export type RobotsRules = { disallow: string[]; allow: string[]; sitemaps: string[] };

/** Rules that apply to everyone (`User-agent: *`), plus any listed sitemaps. */
export function parseRobots(txt: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [], sitemaps: [] };
  let applies = false;
  let sawAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "sitemap") { if (val) rules.sitemaps.push(val); continue; }
    if (key === "user-agent") {
      // A new group starts; `applies` tracks whether this group is for "*".
      if (sawAgent && !applies) { /* previous non-* group ended */ }
      applies = val === "*";
      sawAgent = true;
      continue;
    }
    if (!applies) continue;
    if (key === "disallow" && val) rules.disallow.push(val);
    if (key === "allow" && val) rules.allow.push(val);
  }
  return rules;
}

function ruleMatches(rule: string, path: string): boolean {
  // Support the common `*` wildcard and `$` end anchor.
  const esc = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp("^" + (esc.endsWith("\\$") ? esc.slice(0, -2) + "$" : esc));
  return re.test(path);
}

/** Longest-match wins, as crawlers do; no rules = allowed. */
export function isAllowed(path: string, rules: RobotsRules): boolean {
  const dis = rules.disallow.filter((r) => ruleMatches(r, path)).sort((a, b) => b.length - a.length)[0];
  if (!dis) return true;
  const al = rules.allow.filter((r) => ruleMatches(r, path)).sort((a, b) => b.length - a.length)[0];
  return Boolean(al && al.length >= dis.length);
}

/* ─────────────── sitemaps (pure) ─────────────── */

export function sitemapLocs(xml: string): string[] {
  return [...new Set(Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (m) => decodeXml(m[1])))];
}
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}
function decodeXml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

const PRODUCTISH = /\/(product|products|product-page|item|items|meal|meals|menu-item|menu|shop|store|dish|dishes|p)\/[^/?#]+/i;
const NOT_PRODUCT = /\/(collections?|category|categories|tag|tags|page|blog|post|posts|news|cart|checkout|account|search)\b|-sitemap\.xml$|\.(jpg|jpeg|png|webp|gif|pdf|xml)$/i;

/** Child sitemaps worth opening first (products/store/menu), then the rest. */
export function rankChildSitemaps(locs: string[]): string[] {
  const score = (u: string) => (/product|store|shop|menu|item|meal/i.test(u) ? 0 : /page/i.test(u) ? 1 : 2);
  return [...locs].sort((a, b) => score(a) - score(b));
}

/** Same-host URLs that look like one product/dish page each. */
export function pickProductUrls(locs: string[], host: string, cap = 80): string[] {
  const bare = host.replace(/^www\./, "");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of locs) {
    let url: URL;
    try { url = new URL(u); } catch { continue; }
    if (url.hostname.replace(/^www\./, "") !== bare) continue;
    const path = url.pathname;
    if (!PRODUCTISH.test(path) || NOT_PRODUCT.test(path)) continue;
    const key = bare + path; // www and bare host are the same page
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url.origin + path);
    if (out.length >= cap) break;
  }
  return out;
}

/* ─────────────── JSON-LD (pure) ─────────────── */

type Json = Record<string, unknown>;

function* walkJson(x: unknown): Generator<Json> {
  if (Array.isArray(x)) { for (const v of x) yield* walkJson(v); return; }
  if (x && typeof x === "object") {
    yield x as Json;
    for (const v of Object.values(x as Json)) yield* walkJson(v);
  }
}

/** Dollars-ish string/number → integer cents; null when not a sane menu price. */
export function toCents(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 2000) return null;
  return Math.round(n * 100);
}

/** Every Product / MenuItem with a price in a page's JSON-LD blocks. */
export function extractJsonLdProducts(html: string, pageUrl: string): FetchedItem[] {
  const out: FetchedItem[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const node of walkJson(data)) {
      const t = node["@type"];
      const types = Array.isArray(t) ? t.map(String) : [String(t ?? "")];
      if (!types.some((x) => x === "Product" || x === "MenuItem")) continue;
      const name = decodeEntities(String(node.name ?? ""));
      if (!name) continue;
      const offers = node.offers;
      const offer = (Array.isArray(offers) ? offers[0] : offers) as Json | undefined;
      const cents = toCents(offer?.price ?? offer?.lowPrice ?? (offer?.priceSpecification as Json | undefined)?.price);
      if (!cents) continue;
      const currency = String(offer?.priceCurrency ?? "").toUpperCase();
      if (currency && !["CAD", "USD"].includes(currency)) continue;
      const url = typeof node.url === "string" ? node.url : typeof offer?.url === "string" ? offer.url : pageUrl;
      const sku = node.sku ?? node.productID ?? node["@id"];
      out.push({ externalId: sku ? String(sku).slice(0, 120) : slugOf(name), name: name.slice(0, 140), priceCents: cents, url: url.slice(0, 500), portion: portionOf(name) });
    }
  }
  // De-dupe by externalId (a page can repeat the same product in several blocks).
  const seen = new Set<string>();
  return out.filter((i) => (seen.has(i.externalId) ? false : (seen.add(i.externalId), true)));
}

/** Decode the HTML entities store feeds leave in names (&amp;, &#8217;, &rsquo;…). */
export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", eacute: "\u00e9", egrave: "\u00e8", agrave: "\u00e0", ccedil: "\u00e7" };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, k: string) => named[k.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

// Listings that are never a single plate to compare against: gift cards,
// deposits, services, memberships, whole-week packages priced in the hundreds.
const NON_MENU_RE = /\b(gift ?card|gift certificate|e-?gift|deposit|tip|donation|membership|subscription|service[s]?\b|consult|delivery fee|shipping|cooler bag|ice pack|merch|t-shirt|hoodie|bottle|tumbler)\b/i;
export function isNonMenuListing(name: string, priceCents: number): boolean {
  return NON_MENU_RE.test(name) || priceCents > 15_000 || priceCents < 100;
}

export function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}
export function portionOf(text: string): string | null {
  const m = text.match(/(\d{2,4})\s?(g|grams|oz|ml)\b/i);
  return m ? `${m[1]} ${m[2].toLowerCase()}` : null;
}

/* ─────────────── Squarespace (pure) ─────────────── */

type SqItem = { title?: string; fullUrl?: string; variants?: { price?: number | string; priceMoney?: { value?: string } }[]; structuredContent?: { variants?: { price?: number | string; priceMoney?: { value?: string } }[] } };

/** Items from a Squarespace collection fetched with `?format=json`. */
export function squarespaceItems(json: unknown, origin: string): FetchedItem[] {
  const d = json as { items?: SqItem[] } | null;
  if (!d || !Array.isArray(d.items)) return [];
  const out: FetchedItem[] = [];
  for (const it of d.items) {
    const v = (it.variants ?? it.structuredContent?.variants ?? [])[0];
    // Squarespace: priceMoney.value is dollars (string); the legacy `price` number is cents.
    const cents = v?.priceMoney?.value != null ? toCents(v.priceMoney.value) : typeof v?.price === "number" && Number.isInteger(v.price) ? (v.price > 0 && v.price <= 200_000 ? v.price : null) : toCents(v?.price);
    const name = String(it.title ?? "").trim();
    if (!name || !cents) continue;
    out.push({ externalId: slugOf(name), name: name.slice(0, 140), priceCents: cents, url: it.fullUrl ? origin + it.fullUrl : null, portion: portionOf(name) });
  }
  return out;
}

/** Collection urlIds + types from a Squarespace page's `?format=json` payload. */
export function squarespaceCollections(json: unknown): { urlId: string; typeName: string }[] {
  const out = new Map<string, string>();
  for (const node of walkJson(json)) {
    if (typeof node.urlId === "string" && typeof node.typeName === "string") out.set(node.urlId, node.typeName);
  }
  return [...out.entries()].map(([urlId, typeName]) => ({ urlId, typeName }));
}

/* ─────────────── HTML → text (pure) ─────────────── */

const PRICE_RE = /(?:\$|CA\$|C\$|CAD\s?)\s?\d{1,3}(?:[.,]\d{2})\b/g;

export function priceCount(text: string): number {
  return (text.match(PRICE_RE) ?? []).length;
}

/** Visible text of a page, one block per line, scripts/styles removed, capped. */
export function htmlToText(html: string, cap = 24_000): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(script|style|noscript|svg|iframe|head)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<\/?(br|p|div|li|ul|ol|h[1-6]|tr|td|th|section|article|nav|header|footer|main|aside|table|thead|tbody|dl|dt|dd|blockquote|figure|figcaption|form|fieldset|hr|option|label)\b[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const lines = s.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 1);
  // Drop exact-duplicate lines (nav repeated in header/footer) but keep order.
  const seen = new Set<string>();
  const kept = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
  return kept.join("\n").slice(0, cap);
}

/** Same-host links that look like a menu / shop / order page, most promising first. */
export function findMenuLinks(html: string, base: string, cap = 4): string[] {
  const origin = new URL(base).origin;
  const host = new URL(base).hostname.replace(/^www\./, "");
  const scored: { url: string; score: number }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try { u = new URL(m[1], origin); } catch { continue; }
    if (u.hostname.replace(/^www\./, "") !== host) continue;
    const p = (u.pathname + u.search).toLowerCase();
    if (/\.(css|js|png|jpe?g|webp|svg|pdf|ico)(\?|$)/.test(p)) continue;
    const score = /menu|meals|mealsbyunit|a-la-carte|alacarte|single/.test(p) ? 3 : /shop|store|order|products|pricing|plans/.test(p) ? 2 : 0;
    if (!score) continue;
    const key = u.origin + u.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({ url: key, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, cap).map((x) => x.url);
}

/** JS-rendering fetcher URL (Jina Reader); set JINA_API_KEY for higher limits. */
export function renderedFetchUrl(pageUrl: string): string {
  return `https://r.jina.ai/${pageUrl}`;
}
