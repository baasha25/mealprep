// Import column mapping — pure (tested).
//
// Kitchens arrive with whatever their old platform exports. Squarespace,
// Shopify and WooCommerce all name the same facts differently ("First Name" +
// "Last Name" vs "name", "Email Address" vs "email", "Title" vs "name"). This
// maps those headers onto PrepFlow's import columns so an export can be dropped
// in as-is, and reports which source it looked like and what was mapped.

export type ImportKindLike = "menu" | "customers" | "subscriptions" | "inventory";
export type ExportSource = "squarespace" | "shopify" | "woocommerce" | "generic";

const norm = (h: string) => h.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

/** Best guess at which platform produced the file, from its headers alone. */
export function detectExportSource(headers: readonly string[]): ExportSource {
  const h = new Set(headers.map(norm));
  if (h.has("accepts email marketing") || h.has("default address phone") || h.has("handle") || h.has("variant price")) return "shopify";
  if (h.has("regular price") || h.has("sale price") || h.has("sku") && h.has("type") || h.has("billing email")) return "woocommerce";
  if (h.has("product title") || h.has("subscribed to mailing list") || h.has("created on") || (h.has("first name") && h.has("last name") && h.has("email"))) return "squarespace";
  return "generic";
}

// For each PrepFlow column: the export headers (normalized) that mean it, in priority order.
const ALIASES: Record<ImportKindLike, Record<string, string[]>> = {
  customers: {
    name: ["name", "full name", "customer name", "billing name", "shipping name", "display name"],
    email: ["email", "email address", "customer email", "billing email", "e mail"],
    phone: ["phone", "phone number", "billing phone", "default address phone", "mobile", "telephone"],
    dietaryprefs: ["dietaryprefs", "dietary prefs", "dietary preferences", "diet", "preferences"],
    allergens: ["allergens", "allergies", "allergen", "food allergies"],
  },
  menu: {
    name: ["name", "title", "product title", "product name", "item name", "meal"],
    price: ["price", "variant price", "regular price", "unit price", "amount"],
    description: ["description", "body (html)", "body", "short description", "product description", "summary"],
    diet: ["diet", "category", "categories", "product category", "type", "product type", "collection"],
    calories: ["calories", "kcal", "energy"],
    protein: ["protein", "protein (g)", "protein g"],
    carbs: ["carbs", "carbohydrates", "carbs (g)", "net carbs"],
    fat: ["fat", "fat (g)", "total fat"],
    allergens: ["allergens", "allergen", "contains"],
  },
  subscriptions: {
    email: ["email", "email address", "customer email", "billing email"],
    plan: ["plan", "plan name", "product", "product title", "subscription", "title"],
    frequency: ["frequency", "billing frequency", "interval", "cadence", "billing period"],
  },
  inventory: {
    name: ["name", "ingredient", "item", "product name", "title"],
    unit: ["unit", "uom", "unit of measure"],
    quantity: ["quantity", "qty", "on hand", "stock", "inventory quantity"],
    cost: ["cost", "unit cost", "cost per unit", "price"],
    trim: ["trim", "trim %", "waste %", "yield loss"],
  },
};

/** Strip HTML to text (Shopify's "Body (HTML)", Squarespace descriptions). */
export function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export type MappedImport = {
  source: ExportSource;
  records: Record<string, string>[];
  /** { prepflowColumn: exportHeaderUsed } for the preview — only columns that needed mapping. */
  mapped: Record<string, string>;
  /** PrepFlow columns we could not find at all (the importer will report per row). */
  missing: string[];
};

/**
 * Rewrite records keyed by export headers into records keyed by PrepFlow's
 * columns. A record that already uses our headers passes through untouched.
 */
export function mapImportRecords(kind: ImportKindLike, records: readonly Record<string, string>[]): MappedImport {
  const headers = records.length ? Object.keys(records[0]) : [];
  const source = detectExportSource(headers);
  const hset = new Map(headers.map((h) => [norm(h), h]));
  const aliases = ALIASES[kind];
  const mapped: Record<string, string> = {};
  const missing: string[] = [];
  const pick: Record<string, string | null> = {};
  for (const [col, names] of Object.entries(aliases)) {
    const found = names.map((n) => hset.get(norm(n))).find(Boolean) ?? null;
    pick[col] = found;
    if (found && norm(found) !== col) mapped[col] = found;
    if (!found && !(col === "name" && kind === "customers" && hset.has("first name"))) missing.push(col);
  }
  const first = hset.get("first name") ?? hset.get("firstname") ?? hset.get("billing first name") ?? hset.get("shipping first name");
  const last = hset.get("last name") ?? hset.get("lastname") ?? hset.get("billing last name") ?? hset.get("shipping last name");
  if (kind === "customers" && !pick.name && first) mapped.name = last ? `${first} + ${last}` : first;

  const out = records.map((rec) => {
    const r: Record<string, string> = {};
    for (const [col, src] of Object.entries(pick)) if (src) r[col] = rec[src] ?? "";
    if (kind === "customers" && !pick.name && first) r.name = [rec[first], last ? rec[last] : ""].filter(Boolean).join(" ").trim();
    if (kind === "menu" && r.description) r.description = stripHtml(r.description);
    if (kind === "menu" && r.price) r.price = r.price.replace(/[^0-9.]/g, "");
    if (kind === "subscriptions" && r.frequency) {
      const f = r.frequency.toLowerCase();
      r.frequency = /bi|2|two|fortnight/.test(f) ? "biweekly" : /week/.test(f) ? "weekly" : r.frequency;
    }
    // Keep any extra columns too (harmless; lets custom headers still work).
    for (const [k, v] of Object.entries(rec)) if (!(k in r)) r[k] = v;
    return r;
  });
  return { source, records: out, mapped, missing: missing.filter((m) => ["name", "email", "price", "plan", "unit", "quantity"].includes(m)) };
}

export const SOURCE_LABEL: Record<ExportSource, string> = {
  squarespace: "Squarespace export",
  shopify: "Shopify export",
  woocommerce: "WooCommerce export",
  generic: "PrepFlow columns",
};
