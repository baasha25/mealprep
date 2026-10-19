import { describe, it, expect } from "vitest";
import {
  parseRobots,
  isAllowed,
  sitemapLocs,
  isSitemapIndex,
  rankChildSitemaps,
  pickProductUrls,
  extractJsonLdProducts,
  toCents,
  squarespaceItems,
  squarespaceCollections,
  htmlToText,
  priceCount,
  findMenuLinks,
  mapLimit,
  decodeEntities,
  isNonMenuListing,
} from "./competitor-readers";

describe("robots", () => {
  const rules = parseRobots(`# site\nUser-agent: Googlebot\nDisallow: /private\n\nUser-agent: *\nDisallow: /cart\nDisallow: /account/\nAllow: /account/public\nDisallow: /*.pdf$\nSitemap: https://x.com/sitemap.xml\n`);
  it("keeps only the * group and the sitemaps", () => {
    expect(rules.disallow).toEqual(["/cart", "/account/", "/*.pdf$"]);
    expect(rules.sitemaps).toEqual(["https://x.com/sitemap.xml"]);
  });
  it("longest match wins, wildcards and $ work, no rules = allowed", () => {
    expect(isAllowed("/menu", rules)).toBe(true);
    expect(isAllowed("/cart", rules)).toBe(false);
    expect(isAllowed("/account/orders", rules)).toBe(false);
    expect(isAllowed("/account/public/x", rules)).toBe(true);
    expect(isAllowed("/brochure.pdf", rules)).toBe(false);
    expect(isAllowed("/brochure.pdf.html", rules)).toBe(true);
    expect(isAllowed("/anything", parseRobots(""))).toBe(true);
  });
});

describe("sitemaps", () => {
  const index = `<?xml version="1.0"?><sitemapindex xmlns="x"><sitemap><loc>https://a.com/store-products-sitemap.xml</loc></sitemap><sitemap><loc>https://a.com/pages-sitemap.xml</loc></sitemap><sitemap><loc> https://a.com/blog-sitemap.xml </loc></sitemap></sitemapindex>`;
  it("detects an index and ranks product sitemaps first", () => {
    expect(isSitemapIndex(index)).toBe(true);
    const locs = sitemapLocs(index);
    expect(locs).toHaveLength(3);
    expect(rankChildSitemaps(locs)[0]).toContain("store-products");
    expect(rankChildSitemaps(locs)[2]).toContain("blog");
  });
  it("picks one-product-per-page urls on the same host only", () => {
    const urls = pickProductUrls(
      [
        "https://www.a.com/product-page/large-tadka",
        "https://a.com/product-page/large-tadka?x=1",
        "https://a.com/products/chicken-bowl",
        "https://a.com/collections/all",
        "https://a.com/product/tags-sitemap.xml",
        "https://a.com/blog/post-1",
        "https://b.com/products/other",
        "https://a.com/menu/steak-plate",
        "https://a.com/products/photo.jpg",
      ],
      "a.com",
    );
    expect(urls).toEqual(["https://www.a.com/product-page/large-tadka", "https://a.com/products/chicken-bowl", "https://a.com/menu/steak-plate"]);
    expect(pickProductUrls(Array.from({ length: 200 }, (_, i) => `https://a.com/products/p${i}`), "a.com", 50)).toHaveLength(50);
  });
});

describe("JSON-LD", () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Large Homemade Tadka","sku":"T-1","offers":{"@type":"Offer","price":"49","priceCurrency":"CAD","url":"https://a.com/product-page/tadka"}}</script>
    <script type="application/ld+json">{"@graph":[{"@type":"MenuItem","name":"Steak &amp; Veg 450g","offers":[{"price":15.5}]},{"@type":"Product","name":"Euro item","offers":{"price":"9.00","priceCurrency":"EUR"}},{"@type":"Product","name":"Free","offers":{"price":"0"}},{"@type":"Product","name":"Dup","sku":"D"},{"@type":"Product","name":"Dup","sku":"D","offers":{"price":"12"}},{"@type":"Product","name":"Dup","sku":"D","offers":{"price":"12"}}]}</script>
    <script type="application/ld+json">not json</script>
  </head></html>`;
  it("reads Product and MenuItem offers, skips foreign currency, zero and duplicates", () => {
    const items = extractJsonLdProducts(html, "https://a.com/page");
    expect(items.map((i) => [i.name, i.priceCents, i.externalId])).toEqual([
      ["Large Homemade Tadka", 4900, "T-1"],
      ["Steak & Veg 450g", 1550, "steak-veg-450g"],
      ["Dup", 1200, "D"],
    ]);
    expect(items[0].url).toBe("https://a.com/product-page/tadka");
    expect(items[1].url).toBe("https://a.com/page");
    expect(items[1].portion).toBe("450 g");
  });
  it("toCents rejects nonsense", () => {
    expect(toCents("$12.50")).toBe(1250);
    expect(toCents(0)).toBeNull();
    expect(toCents("abc")).toBeNull();
    expect(toCents(5000)).toBeNull();
  });
});

describe("Squarespace", () => {
  it("reads collection items (cents or dollars) and lists collections", () => {
    const json = { items: [{ title: "Chicken Bowl", fullUrl: "/shop/p/chicken", variants: [{ price: 1450 }] }, { title: "Tray", fullUrl: "/shop/p/tray", variants: [{ priceMoney: { value: "45.00" } }] }, { title: "No price" }] };
    const items = squarespaceItems(json, "https://s.com");
    expect(items.map((i) => [i.name, i.priceCents, i.url])).toEqual([["Chicken Bowl", 1450, "https://s.com/shop/p/chicken"], ["Tray", 4500, "https://s.com/shop/p/tray"]]);
    expect(squarespaceCollections({ collection: { urlId: "home", typeName: "page" }, nav: [{ urlId: "shop", typeName: "products" }] })).toEqual([{ urlId: "home", typeName: "page" }, { urlId: "shop", typeName: "products" }]);
  });
});

describe("html → text", () => {
  it("strips scripts/styles, breaks blocks into lines, de-dupes, counts prices", () => {
    const html = `<html><head><style>.x{}</style><script>var a="$99.99"</script></head><body><nav><a href="/menu">Menu</a></nav><div><h3>Chicken &amp; Rice</h3><p>$12.50</p></div><div><h3>Steak Plate</h3><p>CA$ 15.00</p></div><nav><a href="/menu">Menu</a></nav></body></html>`;
    const t = htmlToText(html);
    expect(t).toBe("Menu\nChicken & Rice\n$12.50\nSteak Plate\nCA$ 15.00");
    expect(priceCount(t)).toBe(2);
    expect(priceCount("from $8.25 per meal and $0.00 credit")).toBe(2);
  });
  it("finds same-host menu-ish links, best first, capped", () => {
    const html = `<a href="/about">About</a><a href="/shop">Shop</a><a href="https://www.k.com/mealsbyunit">Meals</a><a href="https://other.com/menu">x</a><a href="/menu.pdf">pdf</a><a href="/order?x=1">Order</a><a href="/menu">Menu</a>`;
    expect(findMenuLinks(html, "https://k.com/", 3)).toEqual(["https://www.k.com/mealsbyunit", "https://k.com/menu", "https://k.com/shop"]);
  });
  it("mapLimit preserves order", async () => {
    const r = await mapLimit([3, 1, 2], 2, async (n) => { await new Promise((res) => setTimeout(res, n * 5)); return n * 10; });
    expect(r).toEqual([30, 10, 20]);
  });
});

describe("names and non-menu filter", () => {
  it("decodes entities and drops gift cards, services and silly prices", () => {
    expect(decodeEntities("Turkey Shepherd&#8217;s Pie &amp; Mash&nbsp;")).toBe("Turkey Shepherd\u2019s Pie & Mash");
    expect(decodeEntities("Caf&eacute; Bowl &#x2014; large")).toBe("Caf\u00e9 Bowl \u2014 large");
    expect(isNonMenuListing("Gift Card", 2500)).toBe(true);
    expect(isNonMenuListing("Meal Prep Services: April 8-10th", 93690)).toBe(true);
    expect(isNonMenuListing("Chicken Bowl", 1450)).toBe(false);
    expect(isNonMenuListing("Water Bottle", 1200)).toBe(true);
    expect(isNonMenuListing("Side salad", 50)).toBe(true);
  });
});
