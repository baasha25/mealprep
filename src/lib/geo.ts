// Visitor country → pricing currency. Pure (tested).
//
// Netlify (and Cloudflare / Vercel, for portability) attach the visitor's
// country to each request. We read it once in middleware, keep only the
// two-letter code in a cookie, and show USD pricing to US visitors. Nothing
// else about the visitor is stored. Parity pricing: the same numbers in USD
// for US kitchens, CAD for everyone else.

export const COUNTRY_COOKIE = "pf_country";
export type Currency = "CAD" | "USD";

/** Country code from whichever edge header is present; null when none is. */
export function countryFromHeaders(get: (name: string) => string | null | undefined): string | null {
  const geo = get("x-nf-geo");
  if (geo) {
    const parsed = parseNfGeo(geo);
    if (parsed) return parsed;
  }
  for (const h of ["x-country", "cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country"]) {
    const v = get(h)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v)) return v;
  }
  return null;
}

/** Netlify's x-nf-geo is JSON (sometimes base64-encoded): { country: { code: "CA" } }. */
function parseNfGeo(raw: string): string | null {
  const tryJson = (s: string): string | null => {
    try {
      const j = JSON.parse(s) as { country?: { code?: string } };
      const c = j?.country?.code?.toUpperCase();
      return c && /^[A-Z]{2}$/.test(c) ? c : null;
    } catch {
      return null;
    }
  };
  return tryJson(raw) ?? (() => {
    try {
      return tryJson(atob(raw));
    } catch {
      return null;
    }
  })();
}

/** Accept a manual override like ?country=US (sales demos, testing). */
export function normalizeCountry(v: string | null | undefined): string | null {
  const c = String(v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export function currencyForCountry(country: string | null | undefined): Currency {
  return country === "US" ? "USD" : "CAD";
}

export const CURRENCY_NOTE: Record<Currency, string> = {
  CAD: "Prices in CAD.",
  USD: "Prices in USD.",
};
