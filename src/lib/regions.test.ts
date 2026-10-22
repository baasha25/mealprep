import { describe, it, expect } from "vitest";
import { provinceForPostal, regionForKitchen, type KitchenEntry } from "./regions";

const entries: KitchenEntry[] = [
  { name: "A", domain: "a.ca", city: "Toronto", region: "GTA", platform: "Shopify", province: "ON" },
  { name: "B", domain: "b.ca", city: "Whitby", region: "East / North", platform: "Shopify", province: "ON" },
  { name: "C", domain: "c.ca", city: "Vancouver", region: "Vancouver / Lower Mainland", platform: "Shopify", province: "BC" },
  { name: "D", domain: "d.ca", city: "Surrey", region: "Vancouver / Lower Mainland", platform: "WooCommerce", province: "BC" },
];

describe("provinceForPostal", () => {
  it("maps the first letter", () => {
    expect(provinceForPostal("V6E")).toBe("BC");
    expect(provinceForPostal("l4c 1a2")).toBe("ON");
    expect(provinceForPostal("T2P")).toBe("AB");
    expect(provinceForPostal("90210")).toBe("US");
    expect(provinceForPostal("")).toBeNull();
  });
});

describe("regionForKitchen", () => {
  it("zones win: a Vancouver kitchen with V-prefixes opens the Lower Mainland list", () => {
    expect(regionForKitchen({ postalPrefixes: ["V6E", "V5Z", "V3H"], serviceArea: "Durham Region" }, entries)).toBe("Vancouver / Lower Mainland");
  });
  it("falls back to the service-area text (region words, then cities), then the first region", () => {
    expect(regionForKitchen({ postalPrefixes: [], serviceArea: "Whitby & Oshawa" }, entries)).toBe("East / North");
    expect(regionForKitchen({ postalPrefixes: [], serviceArea: "Lower Mainland" }, entries)).toBe("Vancouver / Lower Mainland");
    expect(regionForKitchen({ postalPrefixes: [], serviceArea: "" }, entries)).toBe("GTA");
    expect(regionForKitchen({ postalPrefixes: ["T2P"], serviceArea: "" }, entries)).toBe("GTA"); // Alberta: no list yet
    expect(regionForKitchen({ postalPrefixes: [], serviceArea: "" }, [])).toBeNull();
  });
});
