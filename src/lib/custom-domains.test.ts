import { describe, it, expect } from "vitest";
import { parseDomainMap, rewritePathForHost, isValidHostname, normalizeHost, activeStorefrontOrigin, storefrontUrls } from "./custom-domains";

const map = parseDomainMap("order.balancekitchen.ca=balance-kitchen, WWW.Acme.com:3000=acme\nbad-entry, =x, y=");

describe("parseDomainMap", () => {
  it("parses, lowercases, strips port/www, skips junk", () => {
    expect(map.get("order.balancekitchen.ca")).toBe("balance-kitchen");
    expect(map.get("acme.com")).toBe("acme");
    expect(map.size).toBe(2);
  });
});

describe("rewritePathForHost", () => {
  it("root → storefront; account/success/subscribed → under the slug", () => {
    expect(rewritePathForHost("order.balancekitchen.ca", "/", map)).toBe("/store/balance-kitchen");
    expect(rewritePathForHost("ORDER.balancekitchen.ca:443", "/account", map)).toBe("/store/balance-kitchen/account");
    expect(rewritePathForHost("www.acme.com", "/success?x=1".split("?")[0], map)).toBe("/store/acme/success");
  });
  it("leaves /store, /api, assets and unknown hosts alone", () => {
    expect(rewritePathForHost("order.balancekitchen.ca", "/store/balance-kitchen/account", map)).toBeNull();
    expect(rewritePathForHost("order.balancekitchen.ca", "/api/stripe/webhook", map)).toBeNull();
    expect(rewritePathForHost("order.balancekitchen.ca", "/dashboard", map)).toBeNull();
    expect(rewritePathForHost("prepflow.ca", "/", map)).toBeNull();
    expect(rewritePathForHost(null, "/", map)).toBeNull();
  });
});

describe("isValidHostname / normalizeHost", () => {
  it("accepts real hostnames, rejects schemes/paths/junk", () => {
    expect(isValidHostname("order.balancekitchen.ca")).toBe(true);
    expect(isValidHostname("https://x.com")).toBe(false);
    expect(isValidHostname("x.com/path")).toBe(false);
    expect(isValidHostname("localhost")).toBe(false);
    expect(normalizeHost("WWW.Foo.com:8443")).toBe("foo.com");
  });
});

describe("activeStorefrontOrigin / storefrontUrls", () => {
  const map = parseDomainMap("order.balancekitchen.ca=balance-kitchen");
  it("returns the custom origin only when the map has it for this slug", () => {
    expect(activeStorefrontOrigin("order.balancekitchen.ca", "balance-kitchen", map)).toBe("https://order.balancekitchen.ca");
    expect(activeStorefrontOrigin("Order.BalanceKitchen.ca", "balance-kitchen", map)).toBe("https://order.balancekitchen.ca");
    expect(activeStorefrontOrigin("order.balancekitchen.ca", "other-kitchen", map)).toBeNull(); // mapped to someone else
    expect(activeStorefrontOrigin("shop.notlive.com", "balance-kitchen", map)).toBeNull(); // requested, not activated
    expect(activeStorefrontOrigin(null, "balance-kitchen", map)).toBeNull();
  });
  it("builds storefront urls on the custom domain when active, else under /store", () => {
    expect(storefrontUrls("https://prepflow.ca", "balance-kitchen", "https://order.balancekitchen.ca")).toEqual({
      order: "https://order.balancekitchen.ca",
      account: "https://order.balancekitchen.ca/account",
      signup: "https://order.balancekitchen.ca/account?signup",
    });
    expect(storefrontUrls("https://prepflow.ca", "balance-kitchen", null).order).toBe("https://prepflow.ca/store/balance-kitchen");
  });
});
