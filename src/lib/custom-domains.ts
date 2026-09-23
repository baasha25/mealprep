// White-label custom domains — pure, edge-safe (imported by middleware).
// Routing is driven by an env map so the edge never hits the database:
//   CUSTOM_DOMAINS="order.balancekitchen.ca=balance-kitchen, shop.acme.com=acme"
// The kitchen records its desired domain in Settings → Brand (Business.customDomain);
// activation (DNS + this map + the Netlify domain alias) is a concierge step.

export type DomainMap = Map<string, string>;

/** Parse "host=slug, host2=slug2" into a map (hosts lowercased, ports stripped). */
export function parseDomainMap(raw: string | undefined | null): DomainMap {
  const map: DomainMap = new Map();
  for (const part of (raw ?? "").split(/[,\n]/)) {
    const [h, s] = part.split("=").map((x) => x?.trim());
    if (!h || !s) continue;
    map.set(h.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, ""), s);
  }
  return map;
}

/** Normalize a request Host header for lookup. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().split(":")[0].replace(/^www\./, "");
}

// Storefront sub-paths a custom domain serves at its root.
const STORE_PATHS = /^\/(account|success|subscribed)(\/.*)?$/;

/**
 * Where a request on a custom domain should be internally rewritten to.
 * "/"            → /store/<slug>
 * "/account…"    → /store/<slug>/account…   (and /success, /subscribed)
 * "/store/…", "/api/…", assets, anything else → null (leave untouched).
 */
export function rewritePathForHost(host: string | null | undefined, pathname: string, map: DomainMap): string | null {
  const slug = map.get(normalizeHost(host));
  if (!slug) return null;
  if (pathname === "/" || pathname === "") return `/store/${slug}`;
  if (STORE_PATHS.test(pathname)) return `/store/${slug}${pathname}`;
  return null;
}

/** Validate a customer-entered hostname (no scheme, no path). */
export function isValidHostname(h: string): boolean {
  if (!h || h.length > 253) return false;
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(h.toLowerCase());
}

/**
 * If the kitchen's requested customDomain is live in the env map for this slug,
 * return its origin (https://order.theirbrand.com); otherwise null.
 * Used by Share links so buttons on the merchant's own site point at their domain.
 */
export function activeStorefrontOrigin(
  customDomain: string | null | undefined,
  slug: string,
  map: DomainMap,
): string | null {
  const host = normalizeHost(customDomain);
  if (!host || !slug) return null;
  return map.get(host) === slug ? `https://${host}` : null;
}

/** Storefront URLs for a kitchen — on its custom domain when active, else under /store/<slug>. */
export function storefrontUrls(base: string, slug: string, customOrigin: string | null) {
  const root = customOrigin ?? `${base}/store/${slug}`;
  return { order: root, account: `${root}/account`, signup: `${root}/account?signup` };
}
