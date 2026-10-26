import { describe, it, expect } from "vitest";
import { provinceForPostal, regionForKitchen, regionHintForPostal, type KitchenEntry } from "./regions";

const entries: KitchenEntry[] = [
  { name: "A", domain: "a.ca", city: "Toronto", region: "GTA", platform: "Shopify", province: "ON" },
  { name: "B", domain: "b.ca", city: "Whitby", region: "East / North", platform: "Shopify", province: "ON" },
  { name: "C", domain: "c.ca", city: "Vancouver", region: "Vancouver / Lower Mainland", platform: "Shopify", province: "BC" },
  { name: "D", domain: "d.ca", city: "Surrey", region: "Vancouver / Lower Mainland", platform: "WooCommerce", province: "BC" },
  { name: "E", domain: "e.ca", city: "Calgary", region: "Calgary", platform: "Shopify", province: "AB" },
  { name: "F", domain: "f.ca", city: "Edmonton", region: "Edmonton", platform: "WooCommerce", province: "AB" },
  { name: "G", domain: "g.ca", city: "Montréal", region: "Montréal / Laval / Rive-Sud", platform: "Shopify", province: "QC" },
  { name: "H", domain: "h.ca", city: "Québec", region: "Québec City / Lévis", platform: "Custom-built", province: "QC" },
  { name: "I", domain: "i.ca", city: "Gatineau", region: "Gatineau / Outaouais", platform: "Shopify", province: "QC" },
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
    expect(regionForKitchen({ postalPrefixes: ["T2P"], serviceArea: "" }, entries)).toBe("Calgary");
    expect(regionForKitchen({ postalPrefixes: [], serviceArea: "" }, [])).toBeNull();
  });
});

describe("regionHintForPostal", () => {
  it("tells metros apart inside a province", () => {
    expect(regionHintForPostal("T5K")).toBe("Edmonton");
    expect(regionHintForPostal("T8N")).toBe("Edmonton"); // St. Albert
    expect(regionHintForPostal("T3A")).toBe("Calgary");
    expect(regionHintForPostal("T1Y")).toBeNull(); // Calgary NE is T1Y but T1 is also Lethbridge/Medicine Hat — province fallback handles it
    expect(regionHintForPostal("G1R")).toBe("Québec City / Lévis");
    expect(regionHintForPostal("H2X")).toBe("Montréal / Laval / Rive-Sud");
    expect(regionHintForPostal("J7C")).toBe("Montréal / Laval / Rive-Sud"); // Laval / couronne
    expect(regionHintForPostal("J8X")).toBe("Gatineau / Outaouais");
  });
  it("regionForKitchen uses the hint", () => {
    expect(regionForKitchen({ postalPrefixes: ["T5K", "T6E"], serviceArea: "" }, entries)).toBe("Edmonton");
    expect(regionForKitchen({ postalPrefixes: ["G1R"], serviceArea: "" }, entries)).toBe("Québec City / Lévis");
    expect(regionForKitchen({ postalPrefixes: ["J8X"], serviceArea: "" }, entries)).toBe("Gatineau / Outaouais");
    expect(regionForKitchen({ postalPrefixes: ["T1Y"], serviceArea: "" }, entries)).toBe("Calgary"); // province fallback → first AB region
  });
});
