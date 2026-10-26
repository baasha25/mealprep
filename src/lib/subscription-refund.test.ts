import { describe, it, expect } from "vitest";
import { pickRefundableCharge, refundParamsFor, invoiceIdOf } from "./subscription-refund";

const base = { amount_refunded: 0, status: "succeeded", refunded: false };
describe("subscription refunds", () => {
  it("picks the newest succeeded charge that still has money to refund", () => {
    const charges = [
      { ...base, id: "old", amount: 28300, created: 1 },
      { ...base, id: "refunded", amount: 28300, amount_refunded: 28300, created: 3 },
      { ...base, id: "failed", amount: 28300, created: 4, status: "failed" },
      { ...base, id: "new", amount: 28300, created: 2 },
    ];
    expect(pickRefundableCharge(charges)?.id).toBe("new");
    expect(pickRefundableCharge([])).toBeNull();
  });
  it("reverses the transfer and refunds the platform fee only for Connect charges", () => {
    expect(refundParamsFor({ ...base, id: "ch_1", amount: 28300, created: 1, transfer_data: { destination: "acct_x" } })).toEqual({ charge: "ch_1", amount: 28300, reverse_transfer: true, refund_application_fee: true });
    expect(refundParamsFor({ ...base, id: "ch_2", amount: 28300, amount_refunded: 300, created: 1, transfer_data: null })).toEqual({ charge: "ch_2", amount: 28000 });
  });
  it("reads the invoice id from either shape", () => {
    expect(invoiceIdOf({ ...base, id: "c", amount: 1, created: 1, invoice: "in_1" })).toBe("in_1");
    expect(invoiceIdOf({ ...base, id: "c", amount: 1, created: 1, invoice: { id: "in_2" } })).toBe("in_2");
    expect(invoiceIdOf({ ...base, id: "c", amount: 1, created: 1 })).toBeNull();
  });
});
