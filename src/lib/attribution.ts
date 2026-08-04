// First-touch acquisition attribution — pure helpers (no DOM), so they're unit
// testable. The client captures once into a cookie; onboarding reads it and
// stamps the Business. Used by /admin to show where kitchens come from.

export const ATTRIB_COOKIE = "pf_attrib";

export type Attribution = {
  source: string; // google, instagram, direct, producthunt, ...
  medium: string; // referral, social, cpc, direct, ...
  campaign: string;
  referrer: string;
};

const HOST_SOURCE: [test: RegExp, source: string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\./, "bing"],
  [/(^|\.)duckduckgo\./, "duckduckgo"],
  [/(^|\.)(facebook|fb)\./, "facebook"],
  [/(^|\.)instagram\./, "instagram"],
  [/(^|\.)(t\.co$|twitter\.|x\.com$)/, "twitter"],
  [/(^|\.)linkedin\./, "linkedin"],
  [/(^|\.)youtube\./, "youtube"],
  [/(^|\.)tiktok\./, "tiktok"],
  [/(^|\.)reddit\./, "reddit"],
  [/(^|\.)producthunt\./, "producthunt"],
  [/(^|\.)pinterest\./, "pinterest"],
];

/** Map a referrer URL to a coarse source label. Empty/invalid → "direct". */
export function sourceFromReferrer(referrer: string): string {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  for (const [re, source] of HOST_SOURCE) if (re.test(host)) return source;
  return host.replace(/^www\./, "") || "direct";
}

const SEARCH_SOURCES = new Set(["google", "bing", "duckduckgo"]);
const SOCIAL_SOURCES = new Set(["facebook", "instagram", "twitter", "linkedin", "youtube", "tiktok", "reddit", "pinterest"]);

/** Default medium for a source when no utm_medium is supplied. */
export function mediumForSource(source: string, hasReferrer: boolean): string {
  if (source === "direct") return "direct";
  if (SEARCH_SOURCES.has(source)) return "organic";
  if (SOCIAL_SOURCES.has(source)) return "social";
  return hasReferrer ? "referral" : "direct";
}

/** Build attribution from query params + referrer. UTM values win over referrer. */
export function deriveAttribution(params: URLSearchParams, referrer: string): Attribution {
  const utmSource = (params.get("utm_source") || "").trim().toLowerCase();
  const utmMedium = (params.get("utm_medium") || "").trim().toLowerCase();
  const utmCampaign = (params.get("utm_campaign") || "").trim();
  const source = utmSource || sourceFromReferrer(referrer);
  const medium = utmMedium || mediumForSource(source, Boolean(referrer));
  return { source: source || "direct", medium: medium || "direct", campaign: utmCampaign, referrer: referrer || "" };
}

/** Safe parse of the attribution cookie value (JSON). */
export function parseAttributionCookie(value: string | undefined | null): Attribution | null {
  if (!value) return null;
  try {
    const o = JSON.parse(decodeURIComponent(value)) as Partial<Attribution>;
    if (!o || typeof o !== "object") return null;
    return {
      source: String(o.source || "direct"),
      medium: String(o.medium || "direct"),
      campaign: String(o.campaign || ""),
      referrer: String(o.referrer || ""),
    };
  } catch {
    return null;
  }
}

/** Presentation label for a source (Title Case, "Direct" fallback). */
export function sourceLabel(source: string | null | undefined): string {
  const s = (source || "direct").trim() || "direct";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
