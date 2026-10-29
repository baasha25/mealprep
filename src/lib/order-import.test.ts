import { describe, it, expect } from "vitest";
import { parseCsvRecords } from "./csv";
import {
  buildOrderImport,
  detectOrderSource,
  parseMoneyCents,
  parseOrderDate,
  mapOrderStatus,
  normalizeImportPostal,
  chunkOrders,
  ORDER_IMPORT_TEMPLATE,
} from "./order-import";

const NOW = new Date(2026, 9, 28, 12); // Oct 28 2026

const SHOPIFY =
  "Name,Email,Financial Status,Paid at,Fulfillment Status,Currency,Subtotal,Shipping,Taxes,Total,Shipping Method,Created at,Lineitem quantity,Lineitem name,Lineitem price,Billing Name,Shipping Zip,Tags\n" +
  '#1001,jane@example.com,paid,2026-07-03 10:12:00 -0400,fulfilled,CAD,65.50,5.00,8.52,79.02,Local Delivery,2026-07-03 10:11:00 -0400,3,Steak Bowl,15.50,Jane Doe,m5v2t6,\n' +
  ",,,,,,,,,,,,2,Salmon Poke,9.50,,,\n" +
  '#1002,sam@example.com,refunded,2026-07-04 09:00:00 -0400,,CAD,31.00,0.00,4.03,35.03,Pickup,2026-07-04 08:59:00 -0400,2,Steak Bowl,15.50,Sam Lee,,Subscription\n' +
  '#1003,,pending,,,CAD,15.50,0,0,15.50,,2026-07-05 08:00:00 -0400,1,Steak Bowl,15.50,Walk In,,\n';

const WOO =
  "Order Number,Order Date,Order Status,Billing Email,Billing First Name,Billing Last Name,Item Name,Quantity,Item Cost,Order Total,Order Tax,Shipping Method,Billing Postcode\n" +
  "501,01/15/2026,wc-completed,ann@example.com,Ann,Park,Chicken Rice,4,11.00,52.72,5.72,Flat rate,L4C 1A1\n" +
  "501,01/15/2026,wc-completed,ann@example.com,Ann,Park,Brownie,1,3.00,52.72,5.72,Flat rate,L4C 1A1\n" +
  "502,15/01/2026,cancelled,bob@example.com,Bob,Lo,Chicken Rice,1,11.00,12.43,1.43,Local pickup,\n";

const SQUARE =
  "Date,Time,Item,Qty,Price Point Name,Gross Sales,Net Sales,Customer Name,Transaction ID\n" +
  "2026-03-02,11:05:00,Protein Box,2,Regular,$27.00,$27.00,Dee Wu,T-1\n" +
  "2026-03-02,11:05:00,Protein Box,-1,Regular,($13.50),($13.50),Dee Wu,T-2\n";

describe("detectOrderSource", () => {
  it("recognises Shopify, WooCommerce, Square and generic", () => {
    expect(detectOrderSource(["Name", "Lineitem name", "Lineitem quantity"])).toBe("shopify");
    expect(detectOrderSource(["Order Number", "Item Name", "Quantity"])).toBe("woocommerce");
    expect(detectOrderSource(["Date", "Item", "Gross Sales", "Transaction ID"])).toBe("square");
    expect(detectOrderSource(["order", "date", "meal", "qty", "price"])).toBe("generic");
  });
});

describe("parseMoneyCents", () => {
  it("reads currency symbols, thousands separators and negatives", () => {
    expect(parseMoneyCents("$12.50")).toBe(1250);
    expect(parseMoneyCents("CA$ 1,234.00")).toBe(123400);
    expect(parseMoneyCents("1.234,56")).toBe(123456);
    expect(parseMoneyCents("(5.00)")).toBe(-500);
    expect(parseMoneyCents("-3")).toBe(-300);
    expect(parseMoneyCents("")).toBeNull();
    expect(parseMoneyCents("n/a")).toBeNull();
  });
});

describe("parseOrderDate", () => {
  it("reads ISO, Shopify, month-first and day-first dates", () => {
    expect(parseOrderDate("2026-07-03", NOW)?.toDateString()).toBe(new Date(2026, 6, 3).toDateString());
    expect(parseOrderDate("2026-07-03 10:12:00 -0400", NOW)?.getDate()).toBe(3);
    expect(parseOrderDate("01/15/2026", NOW)?.getMonth()).toBe(0);
    expect(parseOrderDate("15/01/2026", NOW)?.getMonth()).toBe(0);
    expect(parseOrderDate("7/4/26", NOW)?.getFullYear()).toBe(2026);
  });
  it("rejects garbage, ancient and far-future dates", () => {
    expect(parseOrderDate("yesterday", NOW)).toBeNull();
    expect(parseOrderDate("1999-01-01", NOW)).toBeNull();
    expect(parseOrderDate("2030-01-01", NOW)).toBeNull();
    expect(parseOrderDate("13/13/2026", NOW)).toBeNull();
    expect(parseOrderDate("", NOW)).toBeNull();
  });
});

describe("mapOrderStatus", () => {
  const past = new Date(2026, 0, 1);
  const future = new Date(2026, 11, 1);
  it("maps paid-like statuses by date, refunds/cancels by word, and drops non-sales", () => {
    expect(mapOrderStatus("paid", past, NOW)).toBe("fulfilled");
    expect(mapOrderStatus("wc-completed", past, NOW)).toBe("fulfilled");
    expect(mapOrderStatus("", future, NOW)).toBe("paid");
    expect(mapOrderStatus("Refunded", past, NOW)).toBe("refunded");
    expect(mapOrderStatus("partially_refunded", past, NOW)).toBe("refunded");
    expect(mapOrderStatus("cancelled", past, NOW)).toBe("canceled");
    expect(mapOrderStatus("voided", past, NOW)).toBe("canceled");
    expect(mapOrderStatus("pending", past, NOW)).toBeNull();
    expect(mapOrderStatus("wc-failed", past, NOW)).toBeNull();
    expect(mapOrderStatus("on-hold", past, NOW)).toBeNull();
  });
});

describe("normalizeImportPostal", () => {
  it("formats Canadian and US codes", () => {
    expect(normalizeImportPostal("m5v2t6")).toBe("M5V 2T6");
    expect(normalizeImportPostal(" M5V 2T6 ")).toBe("M5V 2T6");
    expect(normalizeImportPostal("902101234")).toBe("90210");
    expect(normalizeImportPostal("")).toBeNull();
  });
});

describe("buildOrderImport — Shopify", () => {
  const b = buildOrderImport(parseCsvRecords(SHOPIFY), NOW);
  it("groups continuation rows into the order and reads order-level fields from the first row", () => {
    expect(b.source).toBe("shopify");
    expect(b.missing).toEqual([]);
    const o = b.orders.find((x) => x.ref === "#1001")!;
    expect(o.items).toEqual([
      { name: "Steak Bowl", qty: 3, unitPriceCents: 1550 },
      { name: "Salmon Poke", qty: 2, unitPriceCents: 950 },
    ]);
    expect(o.email).toBe("jane@example.com");
    expect(o.customerName).toBe("Jane Doe");
    expect(o.subtotalCents).toBe(6550);
    expect(o.taxCents).toBe(852);
    expect(o.feesCents).toBe(500);
    expect(o.totalCents).toBe(7902);
    expect(o.status).toBe("fulfilled");
    expect(o.fulfillment).toBe("delivery");
    expect(o.postalCode).toBe("M5V 2T6");
    expect(o.date.slice(0, 10)).toBe(new Date(2026, 6, 3, 10, 12).toISOString().slice(0, 10));
  });
  it("keeps refunded orders as refunded, reads pickup and subscription tags, drops pending", () => {
    const r = b.orders.find((x) => x.ref === "#1002")!;
    expect(r.status).toBe("refunded");
    expect(r.fulfillment).toBe("pickup");
    expect(r.type).toBe("subscription");
    expect(b.orders.find((x) => x.ref === "#1003")).toBeUndefined();
    expect(b.skipped.some((s) => /not a sale/.test(s.message))).toBe(true);
  });
  it("summarises sold revenue only and counts units per item", () => {
    expect(b.summary.orders).toBe(2);
    expect(b.summary.lines).toBe(3);
    expect(b.summary.revenueCents).toBe(7902); // refunded #1002 excluded
    expect(b.summary.customers).toBe(2);
    expect(b.summary.mealUnits).toEqual({ "Steak Bowl": 5, "Salmon Poke": 2 });
    expect(b.summary.firstDate?.slice(0, 7)).toBe("2026-07");
  });
});

describe("buildOrderImport — WooCommerce", () => {
  const b = buildOrderImport(parseCsvRecords(WOO), NOW);
  it("joins first + last name, strips wc- prefixes and uses the order total column", () => {
    expect(b.source).toBe("woocommerce");
    const o = b.orders.find((x) => x.ref === "501")!;
    expect(o.customerName).toBe("Ann Park");
    expect(o.items.length).toBe(2);
    expect(o.subtotalCents).toBe(4700);
    expect(o.taxCents).toBe(572);
    expect(o.totalCents).toBe(5272);
    expect(o.status).toBe("fulfilled");
    expect(o.postalCode).toBe("L4C 1A1");
    const c = b.orders.find((x) => x.ref === "502")!;
    expect(c.status).toBe("canceled");
    expect(c.fulfillment).toBe("pickup");
    expect(c.date.slice(0, 10)).toBe(new Date(2026, 0, 15, 12).toISOString().slice(0, 10));
  });
});

describe("buildOrderImport — Square", () => {
  const b = buildOrderImport(parseCsvRecords(SQUARE), NOW);
  it("derives the unit price from gross sales and skips negative refund lines", () => {
    expect(b.source).toBe("square");
    expect(b.orders.length).toBe(1);
    expect(b.orders[0].items[0]).toEqual({ name: "Protein Box", qty: 2, unitPriceCents: 1350 });
    expect(b.orders[0].customerName).toBe("Dee Wu");
    expect(b.orders[0].email).toBeNull();
    expect(b.skipped.some((s) => /negative/.test(s.message))).toBe(true);
  });
});

describe("buildOrderImport — template and edge cases", () => {
  it("imports our own template with tax, fees and totals per order", () => {
    const b = buildOrderImport(parseCsvRecords(ORDER_IMPORT_TEMPLATE), NOW);
    expect(b.source).toBe("generic");
    expect(b.orders.length).toBe(2);
    const o = b.orders.find((x) => x.ref === "1001")!;
    expect(o.items.length).toBe(2);
    expect(o.subtotalCents).toBe(6550);
    expect(o.taxCents).toBe(488);
    expect(o.feesCents).toBe(500);
    expect(o.totalCents).toBe(4738);
  });
  it("reports missing required columns instead of guessing", () => {
    const b = buildOrderImport(parseCsvRecords("date,qty\n2026-01-01,2"), NOW);
    expect(b.missing).toEqual(["item", "price"]);
    expect(b.orders).toEqual([]);
  });
  it("groups rows by day + customer when there is no order column, and totals from lines", () => {
    const csv = "date,email,meal,qty,price\n2026-05-01,a@x.com,Bowl,1,10\n2026-05-01,a@x.com,Wrap,2,8\n2026-05-02,a@x.com,Bowl,1,10";
    const b = buildOrderImport(parseCsvRecords(csv), NOW);
    expect(b.orders.length).toBe(2);
    expect(b.orders[0].ref).toBe("auto:2026-05-01:a@x.com");
    expect(b.orders[0].totalCents).toBe(2600);
    expect(b.orders[0].taxCents).toBe(0);
    // Same file again → same refs, so the server can skip duplicates.
    expect(buildOrderImport(parseCsvRecords(csv), NOW).orders.map((o) => o.ref)).toEqual(b.orders.map((o) => o.ref));
  });
  it("treats an unexplained gap between lines and total as fees when no tax/fee columns exist", () => {
    const csv = "order,date,meal,qty,price,total\n9,2026-05-01,Bowl,2,10,23.50";
    const o = buildOrderImport(parseCsvRecords(csv), NOW).orders[0];
    expect(o.subtotalCents).toBe(2000);
    expect(o.feesCents).toBe(350);
    expect(o.totalCents).toBe(2350);
  });
  it("skips orders with unreadable dates and lines with bad quantities", () => {
    const csv = "order,date,meal,qty,price\n1,soon,Bowl,2,10\n2,2026-05-01,Bowl,two,10\n2,2026-05-01,Wrap,1,8";
    const b = buildOrderImport(parseCsvRecords(csv), NOW);
    expect(b.orders.length).toBe(1);
    expect(b.orders[0].items).toEqual([{ name: "Wrap", qty: 1, unitPriceCents: 800 }]);
    expect(b.skipped.length).toBe(2);
  });
});

describe("chunkOrders", () => {
  it("splits into fixed-size chunks", () => {
    expect(chunkOrders([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkOrders([], 2)).toEqual([]);
  });
});
