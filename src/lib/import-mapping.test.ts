import { describe, it, expect } from "vitest";
import { mapImportRecords, detectExportSource, stripHtml } from "./import-mapping";

describe("import mapping", () => {
  it("maps a Squarespace customer export: first + last name, email, phone", () => {
    const rows = [{ "first name": "Kayan", "last name": "Hamadeh", email: "k@example.com", phone: "604 555 0100", "created on": "2026-01-02", "subscribed to mailing list": "Yes" }];
    const m = mapImportRecords("customers", rows);
    expect(m.source).toBe("squarespace");
    expect(m.records[0]).toMatchObject({ name: "Kayan Hamadeh", email: "k@example.com", phone: "604 555 0100" });
    expect(m.mapped.name).toBe("first name + last name");
    expect(m.missing).toEqual([]);
  });
  it("maps a Shopify customer export and detects the source", () => {
    const rows = [{ "first name": "Sam", "last name": "Lee", email: "s@example.com", "accepts email marketing": "yes", "default address phone": "+1 416 555 0102" }];
    const m = mapImportRecords("customers", rows);
    expect(m.source).toBe("shopify");
    expect(m.records[0]).toMatchObject({ name: "Sam Lee", email: "s@example.com", phone: "+1 416 555 0102" });
  });
  it("maps a product export to the menu columns, stripping HTML and currency", () => {
    const rows = [{ title: "Salmon Bowl", "variant price": "$14.00", "body (html)": "<p>Fresh <b>salmon</b>, greens</p>", type: "Low Carb", handle: "salmon-bowl" }];
    const m = mapImportRecords("menu", rows);
    expect(m.source).toBe("shopify");
    expect(m.records[0]).toMatchObject({ name: "Salmon Bowl", price: "14.00", description: "Fresh salmon, greens", diet: "Low Carb" });
  });
  it("passes PrepFlow's own columns through untouched and flags missing essentials", () => {
    const m = mapImportRecords("customers", [{ name: "Jane", email: "j@example.com", phone: "" }]);
    expect(m.source).toBe("generic");
    expect(m.mapped).toEqual({});
    expect(m.records[0].name).toBe("Jane");
    const bad = mapImportRecords("customers", [{ nickname: "x", mobile: "1" }]);
    expect(bad.missing).toEqual(["name", "email"]);
  });
  it("normalises subscription frequency words", () => {
    const m = mapImportRecords("subscriptions", [{ "email address": "a@b.c", product: "Pro", "billing frequency": "Every 2 weeks" }]);
    expect(m.records[0]).toMatchObject({ email: "a@b.c", plan: "Pro", frequency: "biweekly" });
  });
  it("detectExportSource and stripHtml basics", () => {
    expect(detectExportSource(["Regular price", "Sale price", "Name"])).toBe("woocommerce");
    expect(stripHtml("<p>a&amp;b</p><br>c")).toBe("a&b c");
  });
});
