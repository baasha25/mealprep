import { describe, it, expect } from "vitest";
import { countryFromHeaders, currencyForCountry, normalizeCountry } from "./geo";

const h = (map: Record<string, string>) => (name: string) => map[name.toLowerCase()] ?? null;

describe("countryFromHeaders", () => {
  it("reads Netlify's x-nf-geo as JSON or base64 JSON", () => {
    expect(countryFromHeaders(h({ "x-nf-geo": JSON.stringify({ country: { code: "us" } }) }))).toBe("US");
    expect(countryFromHeaders(h({ "x-nf-geo": btoa(JSON.stringify({ country: { code: "CA" }, city: "Toronto" })) }))).toBe("CA");
  });
  it("falls back to other edge headers and ignores junk", () => {
    expect(countryFromHeaders(h({ "x-country": "us" }))).toBe("US");
    expect(countryFromHeaders(h({ "cf-ipcountry": "GB" }))).toBe("GB");
    expect(countryFromHeaders(h({ "x-country": "USA" }))).toBeNull();
    expect(countryFromHeaders(h({}))).toBeNull();
    expect(countryFromHeaders(h({ "x-nf-geo": "not json" }))).toBeNull();
  });
});

describe("currency", () => {
  it("USD for the US, CAD for everyone else (including unknown)", () => {
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("CA")).toBe("CAD");
    expect(currencyForCountry("GB")).toBe("CAD");
    expect(currencyForCountry(null)).toBe("CAD");
    expect(normalizeCountry(" us ")).toBe("US");
    expect(normalizeCountry("x")).toBeNull();
  });
});
