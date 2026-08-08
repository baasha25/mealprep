import { describe, it, expect, beforeEach } from "vitest";

// The module reads env at call time, so set it before importing dynamically.
async function load() {
  return import("./demo-session");
}

describe("demo-session", () => {
  beforeEach(() => {
    process.env.DEMO_SECRET = "unit-test-secret-abcdef123456";
    process.env.DEMO_PASSCODE = "showtime";
  });

  it("signs and verifies a token round-trip", async () => {
    const { signDemoToken, verifyDemoToken } = await load();
    const token = signDemoToken("biz_123")!;
    expect(token).toContain("biz_123.");
    expect(verifyDemoToken(token)).toBe("biz_123");
  });

  it("rejects a tampered signature", async () => {
    const { verifyDemoToken } = await load();
    expect(verifyDemoToken("biz_123.deadbeef")).toBeNull();
  });

  it("rejects a swapped business id (sig no longer matches)", async () => {
    const { signDemoToken, verifyDemoToken } = await load();
    const token = signDemoToken("biz_123")!;
    const forged = "biz_999." + token.split(".")[1];
    expect(verifyDemoToken(forged)).toBeNull();
  });

  it("checks the passcode with constant-time compare", async () => {
    const { checkDemoPasscode } = await load();
    expect(checkDemoPasscode("showtime")).toBe(true);
    expect(checkDemoPasscode("wrong")).toBe(false);
    expect(checkDemoPasscode("")).toBe(false);
  });

  it("fails closed when no secret/passcode is configured", async () => {
    process.env.DEMO_SECRET = "";
    process.env.DEMO_PASSCODE = "";
    const { signDemoToken, verifyDemoToken, checkDemoPasscode, demoEnabled } = await load();
    expect(signDemoToken("biz_123")).toBeNull();
    expect(verifyDemoToken("biz_123.whatever")).toBeNull();
    expect(checkDemoPasscode("anything")).toBe(false);
    expect(demoEnabled()).toBe(false);
  });

  it("demoEnabled true only when both are set", async () => {
    const { demoEnabled } = await load();
    expect(demoEnabled()).toBe(true);
  });
});
