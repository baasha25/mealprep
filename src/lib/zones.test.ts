import { describe, it, expect } from "vitest";
import { normalizePostal, parsePrefixes, zoneForPostal, zoneDays, zoneFeeCents, validateZones, postalLooksComplete, kitchenDaysWithZones, type ZoneLike } from "./zones";

const zones: ZoneLike[] = [
  { id: "n", name: "North", postalPrefixes: ["L4C", "L4E"], deliveryDays: { Mon: true }, deliveryFeeCents: 499 },
  { id: "d", name: "Downtown", postalPrefixes: ["M5V", "M5"], deliveryDays: { Wed: true, Fri: true }, deliveryFeeCents: null },
  { id: "c", name: "Core", postalPrefixes: ["M5V1"], deliveryDays: {}, deliveryFeeCents: 0 },
];
const kitchenDays = { Mon: true, Wed: true, Fri: true };

describe("postal helpers", () => {
  it("normalises Canadian and US codes and owner-typed prefix lists", () => {
    expect(normalizePostal(" l4c 1a2 ")).toBe("L4C1A2");
    expect(normalizePostal("90210-1234")).toBe("902101234");
    expect(parsePrefixes("L4C, l4e L4S\nM5V, L4C, x")).toEqual(["L4C", "L4E", "L4S", "M5V"]);
    expect(postalLooksComplete("L4")).toBe(false);
    expect(postalLooksComplete("L4C")).toBe(true);
  });
});

describe("zoneForPostal", () => {
  it("matches by prefix, longest wins, null when nothing matches or too short", () => {
    expect(zoneForPostal("L4C 1A2", zones)?.name).toBe("North");
    expect(zoneForPostal("m5v 2k7", zones)?.name).toBe("Downtown");
    expect(zoneForPostal("M5V 1B1", zones)?.name).toBe("Core"); // M5V1 beats M5V and M5
    expect(zoneForPostal("M5A 1A1", zones)?.name).toBe("Downtown"); // via M5
    expect(zoneForPostal("K1A 0B1", zones)).toBeNull();
    expect(zoneForPostal("L", zones)).toBeNull();
    expect(zoneForPostal("L4C 1A2", [])).toBeNull();
  });
});

describe("zone days and fee", () => {
  it("uses the zone's days/fee and falls back to the kitchen's", () => {
    expect(zoneDays(zones[0], kitchenDays)).toEqual({ Mon: true });
    expect(zoneDays(zones[2], kitchenDays)).toEqual(kitchenDays); // empty days → kitchen's
    expect(zoneDays(null, kitchenDays)).toEqual(kitchenDays);
    expect(zoneFeeCents(zones[0], 799)).toBe(499);
    expect(zoneFeeCents(zones[1], 799)).toBe(799);
    expect(zoneFeeCents(zones[2], 799)).toBe(0); // free delivery zone
    expect(zoneFeeCents(null, 799)).toBe(799);
  });
});

describe("validateZones", () => {
  it("cleans rows, rejects missing names/prefixes, duplicate prefixes and bad fees", () => {
    const ok = validateZones([
      { name: " North ", prefixes: "L4C, l4e", days: { Mon: true, Tue: false }, feeDollars: "4.99" },
      { name: "Downtown", prefixes: "M5V", days: {}, feeDollars: "" },
    ]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.zones[0]).toEqual({ name: "North", postalPrefixes: ["L4C", "L4E"], deliveryDays: { Mon: true }, deliveryFeeCents: 499 });
      expect(ok.zones[1].deliveryFeeCents).toBeNull();
    }
    expect(validateZones([{ name: "", prefixes: "L4C", days: {}, feeDollars: "" }]).ok).toBe(false);
    expect(validateZones([{ name: "A", prefixes: "x", days: {}, feeDollars: "" }]).ok).toBe(false);
    expect(validateZones([{ name: "A", prefixes: "L4C", days: {}, feeDollars: "" }, { name: "B", prefixes: "L4C", days: {}, feeDollars: "" }]).ok).toBe(false);
    expect(validateZones([{ name: "A", prefixes: "L4C", days: {}, feeDollars: "abc" }]).ok).toBe(false);
  });
});

describe("kitchenDaysWithZones", () => {
  it("keeps ticked kitchen days; otherwise unions the zones' days; empty when neither", () => {
    expect(kitchenDaysWithZones({ Mon: true, Wed: false }, zones)).toEqual({ Mon: true, Wed: false });
    expect(kitchenDaysWithZones({ Mon: false }, zones)).toEqual({ Mon: true, Wed: true, Fri: true });
    expect(kitchenDaysWithZones({}, [])).toEqual({});
  });
});
