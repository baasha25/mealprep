// Order-history import — pure (tested).
//
// A switching kitchen already has months of real sales sitting in its old
// platform's order export. This turns that export (Shopify, WooCommerce, Square
// or our own template; one row per line item) into orders PrepFlow can store as
// history, so P&L, menu engineering, analytics and retention run on the
// kitchen's own numbers from day one instead of starting from zero.
//
// Everything here runs in the browser before anything is sent: the file is
// parsed, mapped, grouped into orders and summarised, then uploaded in chunks
// (see src/app/dashboard/import/order-actions.ts).

export type OrderSource = "shopify" | "woocommerce" | "square" | "generic";

export type ImportedLine = { name: string; qty: number; unitPriceCents: number };

export type ImportedOrder = {
  /** The old system's order number; stored as externalRef so a re-import is a no-op. */
  ref: string;
  /** ISO timestamp of the order (day accuracy is what matters). */
  date: string;
  email: string | null;
  customerName: string | null;
  status: "fulfilled" | "paid" | "canceled" | "refunded";
  fulfillment: "delivery" | "pickup";
  type: "one_time" | "subscription";
  postalCode: string | null;
  items: ImportedLine[];
  subtotalCents: number;
  taxCents: number;
  feesCents: number;
  totalCents: number;
};

export type OrderImportBuild = {
  source: OrderSource;
  orders: ImportedOrder[];
  /** { prepflowColumn: exportHeaderUsed } for the preview — only columns that needed mapping. */
  mapped: Record<string, string>;
  /** Required columns we could not find at all. */
  missing: string[];
  skipped: { row: number; message: string }[];
  summary: OrderImportSummary;
};

export type OrderImportSummary = {
  orders: number;
  lines: number;
  revenueCents: number;
  customers: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Units sold per item name (first-seen casing) — used to check which meals exist. */
  mealUnits: Record<string, number>;
};

const DAY = 86_400_000;
export const MAX_IMPORT_ROWS = 25_000;
export const ORDER_CHUNK_SIZE = 60;

const norm = (h: string) => h.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

export function detectOrderSource(headers: readonly string[]): OrderSource {
  const h = new Set(headers.map(norm));
  if (h.has("lineitem name") || h.has("lineitem quantity") || h.has("lineitem price")) return "shopify";
  if (h.has("gross sales") && (h.has("price point name") || h.has("transaction id") || h.has("item"))) return "square";
  if (h.has("order number") || h.has("billing email") || h.has("order status") || h.has("item cost") || h.has("order total")) return "woocommerce";
  return "generic";
}

type Col =
  | "order" | "date" | "email" | "customer" | "item" | "qty" | "price" | "linetotal"
  | "subtotal" | "tax" | "fees" | "total" | "status" | "fulfillment" | "postal" | "type";

const ALIASES: Record<Col, string[]> = {
  order: ["order", "order id", "order number", "order #", "order no", "order no.", "order name", "transaction id", "receipt number", "invoice", "invoice number", "reference"],
  date: ["date", "order date", "created at", "created", "created on", "paid at", "ordered at", "order time", "purchase date", "placed at", "completed date", "fulfilled at"],
  email: ["email", "customer email", "billing email", "email address", "customer e mail", "e mail"],
  customer: ["customer", "customer name", "billing name", "shipping name", "client", "buyer", "full name"],
  item: ["item", "meal", "product", "product name", "item name", "lineitem name", "line item", "line item name", "title", "product title", "sku name", "dish"],
  qty: ["qty", "quantity", "lineitem quantity", "item quantity", "line item quantity", "units", "count"],
  price: ["price", "unit price", "item price", "lineitem price", "item cost", "price each", "unit cost", "each"],
  linetotal: ["line total", "item total", "gross sales", "line item total", "lineitem total", "line amount", "amount", "extended price"],
  subtotal: ["subtotal", "order subtotal", "sub total"],
  tax: ["tax", "taxes", "order tax", "tax total", "total tax", "hst", "gst", "sales tax"],
  fees: ["shipping", "delivery fee", "shipping total", "order shipping", "fees", "shipping cost", "delivery", "delivery charge", "service fee"],
  total: ["total", "order total", "grand total", "total paid", "amount paid", "total (cad)", "total (usd)"],
  status: ["status", "order status", "financial status", "payment status", "state"],
  fulfillment: ["fulfillment", "shipping method", "delivery method", "fulfillment method", "method", "fulfilment"],
  postal: ["postal code", "postal", "zip", "zip code", "shipping zip", "billing zip", "shipping postcode", "billing postcode", "postcode", "shipping postal code", "billing postal code"],
  type: ["type", "order type", "tags", "subscription", "order tags"],
};

/** Money in a cell ("$12.50", "12,50", "CA$ 1,234.00", "(5.00)") → cents; null when not a number. */
export function parseMoneyCents(v: string | undefined | null): number | null {
  if (v == null) return null;
  let s = v.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.includes("-");
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  // "1.234,56" (EU) vs "1,234.56" (NA): the last separator is the decimal mark.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) * (negative ? -1 : 1);
}

/**
 * Order dates arrive as ISO ("2026-01-15"), Shopify ("2026-01-15 14:03:22 -0500"),
 * NA slashes ("01/15/2026") or day-first ("15/01/2026"). Day accuracy is all we
 * need, so time zones are ignored. null when unreadable or implausible.
 */
export function parseOrderDate(v: string | undefined | null, now: Date = new Date()): Date | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  let d: Date | null = null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  const slash = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/.exec(s);
  if (iso) {
    d = new Date(+iso[1], +iso[2] - 1, +iso[3], iso[4] ? +iso[4] : 12, iso[5] ? +iso[5] : 0);
  } else if (slash) {
    const a = +slash[1];
    const b = +slash[2];
    let y = +slash[3];
    if (y < 100) y += 2000;
    // 15/01 can only be day-first; otherwise assume month-first (North America).
    const dayFirst = a > 12;
    const month = dayFirst ? b : a;
    const day = dayFirst ? a : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    d = new Date(y, month - 1, day, slash[4] ? +slash[4] : 12, slash[5] ? +slash[5] : 0);
  } else {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) d = t;
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() < 2000) return null;
  if (d.getTime() > now.getTime() + 366 * DAY) return null;
  return d;
}

/** "paid", "wc-completed", "Refunded", "voided", "pending" → PrepFlow status, or null = not a sale. */
export function mapOrderStatus(v: string | undefined | null, date: Date, now: Date = new Date()): ImportedOrder["status"] | null {
  const s = (v ?? "").trim().toLowerCase().replace(/^wc-/, "");
  if (!s) return date.getTime() > now.getTime() ? "paid" : "fulfilled";
  if (s.includes("refund")) return "refunded";
  if (s.includes("cancel") || s.includes("void")) return "canceled";
  if (/(pending|unpaid|failed|draft|abandon|on hold|on-hold|authorized|expired|checkout|trash)/.test(s)) return null;
  return date.getTime() > now.getTime() ? "paid" : "fulfilled";
}

export function normalizeImportPostal(v: string | undefined | null): string | null {
  const s = (v ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(s)) return `${s.slice(0, 3)} ${s.slice(3)}`;
  if (/^\d{5}(\d{4})?$/.test(s)) return s.slice(0, 5);
  return s.slice(0, 12);
}

type Pick = Partial<Record<Col, string>>;

function pickColumns(headers: readonly string[], source: OrderSource): { pick: Pick; mapped: Record<string, string> } {
  const hset = new Map(headers.map((h) => [norm(h), h]));
  const pick: Pick = {};
  const mapped: Record<string, string> = {};
  for (const [col, names] of Object.entries(ALIASES) as [Col, string[]][]) {
    const found = names.map((n) => hset.get(n)).find(Boolean);
    if (found) pick[col] = found;
  }
  // Shopify's "Name" column is the order number (#1001); its customer is "Billing Name".
  if (source === "shopify") {
    if (hset.has("name")) pick.order = hset.get("name");
    if (!pick.email && hset.has("email")) pick.email = hset.get("email");
  } else if (!pick.customer && hset.has("name") && pick.item !== hset.get("name")) {
    pick.customer = hset.get("name");
  }
  // Square's "Date" + "Time" live in two columns; Woo sometimes has first/last names.
  const first = hset.get("billing first name") ?? hset.get("first name") ?? hset.get("customer first name");
  const last = hset.get("billing last name") ?? hset.get("last name") ?? hset.get("customer last name");
  if (!pick.customer && first) {
    pick.customer = first;
    mapped.customer = last ? `${first} + ${last}` : first;
  }
  for (const [col, src] of Object.entries(pick)) if (src && norm(src) !== col && !(col in mapped)) mapped[col] = src;
  return { pick, mapped };
}

/**
 * Turn parsed CSV records (one row per line item) into orders. Rows that share
 * an order number become one order; without an order column, rows on the same
 * day for the same customer are grouped instead.
 */
export function buildOrderImport(records: readonly Record<string, string>[], now: Date = new Date()): OrderImportBuild {
  const headers = records.length ? Object.keys(records[0]) : [];
  const source = detectOrderSource(headers);
  const { pick, mapped } = pickColumns(headers, source);
  const hset = new Map(headers.map((h) => [norm(h), h]));
  const lastName = hset.get("billing last name") ?? hset.get("last name") ?? hset.get("customer last name");

  const missing: string[] = [];
  if (!pick.item) missing.push("item");
  if (!pick.date) missing.push("date");
  if (!pick.price && !pick.linetotal) missing.push("price");

  const skipped: { row: number; message: string }[] = [];
  const empty: OrderImportSummary = { orders: 0, lines: 0, revenueCents: 0, customers: 0, firstDate: null, lastDate: null, mealUnits: {} };
  if (missing.length || records.length === 0) {
    return { source, orders: [], mapped, missing, skipped, summary: empty };
  }

  type Group = { rows: { rec: Record<string, string>; row: number }[]; order: number };
  const groups = new Map<string, Group>();
  const get = (rec: Record<string, string>, col: Col) => (pick[col] ? (rec[pick[col]!] ?? "").trim() : "");

  let lastKey = "";
  records.slice(0, MAX_IMPORT_ROWS).forEach((rec, i) => {
    const row = i + 2;
    const item = get(rec, "item");
    if (!item) {
      skipped.push({ row, message: "no item name" });
      return;
    }
    let key = get(rec, "order");
    // An export with an order column that leaves it blank on extra line-item
    // rows: those rows belong to the order above them.
    if (!key && pick.order && lastKey && !get(rec, "date")) key = lastKey;
    if (key) lastKey = key;
    if (!key) {
      const d = parseOrderDate(get(rec, "date"), now);
      const who = (get(rec, "email") || get(rec, "customer") || "guest").toLowerCase();
      key = d ? `auto:${d.toISOString().slice(0, 10)}:${who}` : `row:${row}`;
    }
    const g = groups.get(key) ?? { rows: [], order: groups.size };
    g.rows.push({ rec, row });
    groups.set(key, g);
  });

  const orders: ImportedOrder[] = [];
  const mealUnits: Record<string, number> = {};
  const mealCase = new Map<string, string>();
  const customers = new Set<string>();

  for (const [key, g] of groups) {
    // Order-level fields: first non-empty value across the order's rows (Shopify
    // leaves them blank on continuation rows).
    const first = (col: Col) => {
      for (const r of g.rows) {
        const v = get(r.rec, col);
        if (v) return v;
      }
      return "";
    };
    const firstRow = g.rows[0].row;
    const date = parseOrderDate(first("date"), now);
    if (!date) {
      skipped.push({ row: firstRow, message: `unreadable date "${first("date")}"` });
      continue;
    }
    const status = mapOrderStatus(first("status"), date, now);
    if (!status) {
      skipped.push({ row: firstRow, message: `not a sale (status "${first("status")}")` });
      continue;
    }

    const items: ImportedLine[] = [];
    for (const r of g.rows) {
      const name = get(r.rec, "item").slice(0, 120);
      const qtyRaw = get(r.rec, "qty");
      const qty = qtyRaw ? Math.round(Number(qtyRaw.replace(/[^0-9.-]/g, ""))) : 1;
      if (!Number.isFinite(qty) || qty === 0) {
        skipped.push({ row: r.row, message: `quantity "${qtyRaw}" is not a number` });
        continue;
      }
      if (qty < 0) {
        skipped.push({ row: r.row, message: "negative quantity (refund line)" });
        continue;
      }
      let unit = parseMoneyCents(get(r.rec, "price"));
      if (unit == null) {
        const lt = parseMoneyCents(get(r.rec, "linetotal"));
        unit = lt == null ? 0 : Math.round(lt / qty);
      }
      if (unit < 0) unit = 0;
      items.push({ name, qty, unitPriceCents: unit });
    }
    if (items.length === 0) continue;

    const subtotalCents = items.reduce((a, i) => a + i.qty * i.unitPriceCents, 0);
    const taxCol = parseMoneyCents(first("tax"));
    const feesCol = parseMoneyCents(first("fees"));
    const totalCol = parseMoneyCents(first("total"));
    const taxCents = Math.max(0, taxCol ?? 0);
    let feesCents = Math.max(0, feesCol ?? 0);
    let totalCents: number;
    if (totalCol != null && totalCol >= 0) {
      totalCents = totalCol;
      // No tax/fee columns at all: keep the books balanced by treating the gap as fees.
      if (taxCol == null && feesCol == null && totalCents > subtotalCents) feesCents = totalCents - subtotalCents;
    } else {
      totalCents = subtotalCents + taxCents + feesCents;
    }

    const email = first("email").toLowerCase() || null;
    let customerName = first("customer") || null;
    if (customerName && mapped.customer?.includes(" + ") && lastName) {
      const ln = (g.rows[0].rec[lastName] ?? "").trim();
      if (ln) customerName = `${customerName} ${ln}`;
    }
    if (customerName) customerName = customerName.slice(0, 120);
    if (email) customers.add(email);
    else if (customerName) customers.add(`name:${customerName.toLowerCase()}`);

    const fulfillmentRaw = first("fulfillment").toLowerCase();
    const typeRaw = first("type").toLowerCase();
    orders.push({
      ref: key.slice(0, 80),
      date: date.toISOString(),
      email,
      customerName,
      status,
      fulfillment: /pick|collect/.test(fulfillmentRaw) ? "pickup" : "delivery",
      type: /subscri|recurring/.test(typeRaw) ? "subscription" : "one_time",
      postalCode: normalizeImportPostal(first("postal")),
      items,
      subtotalCents,
      taxCents,
      feesCents,
      totalCents,
    });
    for (const it of items) {
      const k = it.name.toLowerCase();
      if (!mealCase.has(k)) mealCase.set(k, it.name);
      mealUnits[mealCase.get(k)!] = (mealUnits[mealCase.get(k)!] ?? 0) + it.qty;
    }
  }

  orders.sort((a, b) => a.date.localeCompare(b.date));
  const sold = orders.filter((o) => o.status === "fulfilled" || o.status === "paid");
  const summary: OrderImportSummary = {
    orders: orders.length,
    lines: orders.reduce((a, o) => a + o.items.length, 0),
    revenueCents: sold.reduce((a, o) => a + o.totalCents, 0),
    customers: customers.size,
    firstDate: orders[0]?.date ?? null,
    lastDate: orders[orders.length - 1]?.date ?? null,
    mealUnits,
  };
  return { source, orders, mapped, missing, skipped, summary };
}

export function chunkOrders<T>(items: readonly T[], size = ORDER_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  shopify: "Shopify orders export",
  woocommerce: "WooCommerce orders export",
  square: "Square items export",
  generic: "PrepFlow columns",
};

export const ORDER_IMPORT_TEMPLATE =
  "order,date,email,customer,meal,qty,price,status,fulfillment,postal,tax,fees,total\n" +
  "1001,2026-07-03,jane@example.com,Jane Doe,BBQ Chicken Bowl,3,12.50,paid,delivery,M5V 2T6,4.88,5.00,47.38\n" +
  "1001,2026-07-03,jane@example.com,Jane Doe,Salmon Poke,2,14.00,paid,delivery,M5V 2T6,,,\n" +
  "1002,2026-07-04,sam@example.com,Sam Lee,BBQ Chicken Bowl,5,12.50,paid,pickup,,8.13,0,70.63";
