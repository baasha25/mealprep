import { describe, it, expect } from "vitest";
import { senderFor, normalizeDomain, isValidLocalPart, addressOf, displayName, simplifyRecords } from "./sender";

describe("senderFor", () => {
  const base = { businessName: "Gaia Kitchen", fallbackFrom: "PrepFlow <orders@send.prepflow.ca>", replyTo: "kayan@gaiakitchen.ca" };
  it("uses the kitchen's own domain once verified", () => {
    expect(senderFor({ ...base, emailDomain: "mail.gaiakitchen.ca", emailDomainStatus: "verified", emailFromLocal: "hello" })).toEqual({ from: "Gaia Kitchen <hello@mail.gaiakitchen.ca>", replyTo: "kayan@gaiakitchen.ca" });
  });
  it("falls back to 'via PrepFlow' before verification (and with a bad local part), keeping reply-to", () => {
    expect(senderFor({ ...base, emailDomain: "mail.gaiakitchen.ca", emailDomainStatus: "pending", emailFromLocal: "hello" }).from).toBe("Gaia Kitchen via PrepFlow <orders@send.prepflow.ca>");
    expect(senderFor({ ...base, emailDomain: "mail.gaiakitchen.ca", emailDomainStatus: "verified", emailFromLocal: "he llo" }).from).toBe("Gaia Kitchen via PrepFlow <orders@send.prepflow.ca>");
    expect(senderFor({ ...base }).replyTo).toBe("kayan@gaiakitchen.ca");
    expect(senderFor({ businessName: 'Bad "Name" <x>', fallbackFrom: "orders@send.prepflow.ca" })).toEqual({ from: "Bad Name x via PrepFlow <orders@send.prepflow.ca>", replyTo: undefined });
  });
});

describe("helpers", () => {
  it("normalises domains and rejects ours", () => {
    expect(normalizeDomain(" https://www.GaiaKitchen.ca/menu ")).toBe("gaiakitchen.ca");
    expect(normalizeDomain("mail.gaiakitchen.ca.")).toBe("mail.gaiakitchen.ca");
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("prepflow.ca")).toBeNull();
    expect(normalizeDomain("x.resend.dev")).toBeNull();
  });
  it("validates local parts and parses addresses", () => {
    expect(isValidLocalPart("hello")).toBe(true);
    expect(isValidLocalPart("orders.team")).toBe(true);
    expect(isValidLocalPart(".hello")).toBe(false);
    expect(isValidLocalPart("he llo")).toBe(false);
    expect(addressOf("PrepFlow <a@b.c>")).toBe("a@b.c");
    expect(addressOf("a@b.c")).toBe("a@b.c");
    expect(displayName("  ")).toBe("Your kitchen");
  });
  it("simplifies Resend records and drops junk", () => {
    const out = simplifyRecords([{ record: "DKIM", type: "TXT", name: "resend._domainkey", value: "p=abc", ttl: "Auto", status: "not_started" }, { nope: true }, "x"]);
    expect(out).toEqual([{ record: "DKIM", type: "TXT", name: "resend._domainkey", value: "p=abc", ttl: "Auto", priority: undefined, status: "not_started" }]);
    expect(simplifyRecords(null)).toEqual([]);
  });
});
