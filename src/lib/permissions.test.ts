import { describe, it, expect } from "vitest";
import { isOwnerOnly, canAccess } from "./permissions";

describe("isOwnerOnly", () => {
  it("flags sensitive areas (and their subpaths)", () => {
    expect(isOwnerOnly("/dashboard/reports")).toBe(true);
    expect(isOwnerOnly("/dashboard/reports/orders")).toBe(true);
    expect(isOwnerOnly("/dashboard/customers/abc123")).toBe(true);
    expect(isOwnerOnly("/dashboard/settings")).toBe(true);
  });
  it("leaves kitchen/selling areas open", () => {
    expect(isOwnerOnly("/dashboard/kds")).toBe(false);
    expect(isOwnerOnly("/dashboard/orders")).toBe(false);
    expect(isOwnerOnly("/dashboard/menu")).toBe(false);
    expect(isOwnerOnly("/dashboard")).toBe(false);
  });
});

describe("canAccess", () => {
  it("owners can access everything", () => {
    expect(canAccess("owner", "/dashboard/reports")).toBe(true);
    expect(canAccess("owner", "/dashboard/kds")).toBe(true);
  });
  it("staff are blocked from owner-only areas", () => {
    expect(canAccess("staff", "/dashboard/reports")).toBe(false);
    expect(canAccess("staff", "/dashboard/settings")).toBe(false);
  });
  it("staff can use kitchen + selling tools", () => {
    expect(canAccess("staff", "/dashboard/kitchen")).toBe(true);
    expect(canAccess("staff", "/dashboard/pos")).toBe(true);
    expect(canAccess("staff", "/dashboard/inventory")).toBe(true);
  });
});
