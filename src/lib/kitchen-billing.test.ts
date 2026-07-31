import { describe, it, expect } from "vitest";
import { kitchenAccess, type BusinessBillingShape } from "./kitchen-billing";

const D = 86_400_000;
const now = new Date("2026-08-01T12:00:00Z");
const base: BusinessBillingShape = {
  trialEndsAt: null,
  billingStatus: "none",
  billingComped: false,
  billingSubscriptionId: null,
};

describe("kitchenAccess", () => {
  it("comped kitchens always have access", () => {
    const a = kitchenAccess({ ...base, billingComped: true, trialEndsAt: new Date(now.getTime() - 999 * D) }, now);
    expect(a.locked).toBe(false);
    expect(a.state).toBe("comped");
  });

  it("in-trial kitchens have access", () => {
    const a = kitchenAccess({ ...base, trialEndsAt: new Date(now.getTime() + 10 * D) }, now);
    expect(a.locked).toBe(false);
    expect(a.state).toBe("trialing");
  });

  it("active subscription = access + subscribed", () => {
    const a = kitchenAccess({ ...base, billingStatus: "active", trialEndsAt: new Date(now.getTime() - 5 * D) }, now);
    expect(a.locked).toBe(false);
    expect(a.state).toBe("subscribed");
    expect(a.subscribed).toBe(true);
  });

  it("past_due keeps access during Stripe retries (grace)", () => {
    const a = kitchenAccess({ ...base, billingStatus: "past_due", trialEndsAt: new Date(now.getTime() - 5 * D) }, now);
    expect(a.locked).toBe(false);
    expect(a.state).toBe("past_due");
  });

  it("trial ended + no subscription = LOCKED", () => {
    const a = kitchenAccess({ ...base, billingStatus: "none", trialEndsAt: new Date(now.getTime() - 1 * D) }, now);
    expect(a.locked).toBe(true);
    expect(a.state).toBe("locked");
  });

  it("canceled subscription after trial = locked", () => {
    const a = kitchenAccess({ ...base, billingStatus: "canceled", trialEndsAt: new Date(now.getTime() - 1 * D) }, now);
    expect(a.locked).toBe(true);
  });

  it("comp wins even over a canceled subscription", () => {
    const a = kitchenAccess({ ...base, billingComped: true, billingStatus: "canceled", trialEndsAt: new Date(now.getTime() - 1 * D) }, now);
    expect(a.locked).toBe(false);
    expect(a.state).toBe("comped");
  });
});
