import { describe, it, expect } from "vitest";
import { TEMPLATES, fillTemplate, templatesForDate, templateVars, offerLabel, templateByKey } from "./campaign-templates";

const vars = templateVars({
  kitchen: "Balance Kitchen",
  serviceArea: "Durham Region",
  storeUrl: "https://order.balance.ca",
  cutoff: "Sat 8:00 PM",
  topMeals: ["Chicken & Rice Bowl", "Tofu Bowl"],
  coupon: { code: "NEWYEAR15", type: "percent", value: 15 },
});

describe("templates", () => {
  it("every template is complete and resolves without leftover tokens", () => {
    const keys = new Set<string>();
    for (const t of TEMPLATES) {
      expect(keys.has(t.key)).toBe(false);
      keys.add(t.key);
      expect(t.label.length).toBeGreaterThan(3);
      expect(t.brief.length).toBeGreaterThan(20);
      const v = { ...vars, code: t.coupon?.code ?? "", offer: offerLabel(t.coupon) };
      const subject = fillTemplate(t.subject, v);
      const body = fillTemplate(t.body, v);
      expect(subject).not.toMatch(/\{\w+\}/);
      expect(body).not.toMatch(/\{\w+\}/);
      expect(body).toContain("https://order.balance.ca");
      if (t.coupon) {
        expect(body).toContain(t.coupon.code);
        expect(t.coupon.code).toMatch(/^[A-Z0-9]{3,16}$/);
      }
      expect(subject.length).toBeLessThanOrEqual(90);
    }
  });
  it("coupon codes are unique across templates", () => {
    const codes = TEMPLATES.map((t) => t.coupon?.code).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("fillTemplate / vars", () => {
  it("fills known tokens, leaves unknown ones visible, builds the area phrase", () => {
    expect(fillTemplate("Hi {kitchen}{areaPhrase}: {nope}", vars)).toBe("Hi Balance Kitchen in Durham Region: {nope}");
    expect(templateVars({ kitchen: "K", storeUrl: "u", cutoff: "", topMeals: [] })).toMatchObject({
      areaPhrase: "",
      deadline: "the weekly cut-off",
      meal1: "this week's menu",
      code: "",
      offer: "",
    });
  });
  it("offerLabel formats percent and flat", () => {
    expect(offerLabel({ code: "X", type: "percent", value: 15 })).toBe("15% off");
    expect(offerLabel({ code: "X", type: "flat", value: 1000 })).toBe("$10.00 off");
    expect(offerLabel(undefined)).toBe("");
  });
});

describe("templatesForDate", () => {
  it("puts this month's and next month's templates first, evergreen next, out-of-season last", () => {
    const oct = templatesForDate(new Date(2026, 9, 16)); // October
    expect(oct[0].now).toBe(true);
    const firstKeys = oct.filter((t) => t.now).map((t) => t.key);
    expect(firstKeys).toEqual(expect.arrayContaining(["thanksgiving", "black-friday"]));
    expect(firstKeys).not.toContain("new-year");
    const last = oct[oct.length - 1];
    expect(last.now).toBe(false);
    expect(last.months.length).toBeGreaterThan(0);
    // evergreen sit between seasonal-now and out-of-season
    const idxWinBack = oct.findIndex((t) => t.key === "win-back");
    const idxNewYear = oct.findIndex((t) => t.key === "new-year");
    expect(idxWinBack).toBeLessThan(idxNewYear);
  });
  it("December flags both holiday-gift and new-year (next month)", () => {
    const dec = templatesForDate(new Date(2026, 11, 3));
    expect(dec.find((t) => t.key === "holiday-gift")?.now).toBe(true);
    expect(dec.find((t) => t.key === "new-year")?.now).toBe(true);
    expect(templateByKey("new-year")?.months).toEqual([1]);
  });
});
