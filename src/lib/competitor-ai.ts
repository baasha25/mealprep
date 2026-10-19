import { getAnthropic } from "@/lib/anthropic";
import type { FetchedItem } from "./competitors";
import { slugOf, portionOf, toCents } from "./competitor-readers";

export type AiPriceRead = { items: FetchedItem[]; planOnly: boolean; note: string | null };

// Forced structured output: one row per individually priced dish. Plans and
// bundles are labelled so they can be excluded from per-plate comparisons.
const RECORD_TOOL = {
  name: "record_menu_prices",
  description: "Record every menu item that has its own listed price on this meal-prep storefront page.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Dish name exactly as listed, without the price." },
            price: { type: "number", description: "Listed price in dollars for ONE unit of this item, e.g. 13.5." },
            portion: { type: ["string", "null"], description: "Stated portion/weight if shown, e.g. '450 g', else null." },
            kind: { type: "string", enum: ["meal", "addon", "bundle", "plan"], description: "meal = a single prepared plate/dish/bowl/entrée; addon = anything that is not a full meal (side, sauce, snack, drink, dessert, protein-only or base-only portion, supplement); bundle = multi-meal box or tray; plan = subscription/per-meal plan pricing." },
          },
          required: ["name", "price", "kind"],
        },
      },
      note: { type: ["string", "null"], description: "One short sentence if prices are hidden behind a plan picker, postal-code gate or login; else null." },
    },
    required: ["items"],
  },
};

/**
 * Read dish names and prices out of page text (raw or JS-rendered). Returns
 * single-plate items only, marked estimated. Never invents: only what the text
 * shows. Costs one Claude call per competitor refresh.
 */
export async function extractPricesWithClaude(pages: { url: string; text: string }[], domain: string): Promise<AiPriceRead> {
  const anthropic = getAnthropic();
  const body = pages.map((p) => `=== PAGE ${p.url} ===\n${p.text}`).join("\n\n").slice(0, 60_000);
  const message = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_menu_prices" },
    system:
      "You extract listed menu prices from meal-prep storefront page text for a price comparison. Rules: only record items whose price appears in the text next to the item; never guess or compute. Use the per-unit price (if a line says '4 for $52', skip it or mark kind=bundle with price 52). Treat '$X per meal' plan pricing as kind=plan. Drinks, snacks, desserts, sauces, supplements and single components (just a protein, just a base) are kind=addon, never meal. Ignore $0.00, credits, referral bonuses, shipping, gift cards and navigation. Keep dish names short and exactly as written. Currency is CAD unless the page says otherwise.",
    messages: [{ role: "user", content: `Site: ${domain}\n\n${body}` }],
  });
  const tool = message.content.find((c) => c.type === "tool_use");
  if (!tool || tool.type !== "tool_use") return { items: [], planOnly: false, note: "No structured answer." };
  const input = tool.input as { items?: { name?: string; price?: number; portion?: string | null; kind?: string }[]; note?: string | null };
  const rows = Array.isArray(input.items) ? input.items : [];
  const meals: FetchedItem[] = [];
  const seen = new Set<string>();
  let plans = 0, addons = 0, fullMeals = 0;
  for (const r of rows) {
    const name = String(r.name ?? "").replace(/\s+/g, " ").trim();
    const cents = toCents(r.price);
    if (!name || !cents) continue;
    if (r.kind === "plan" || r.kind === "bundle") { plans++; continue; }
    const id = slugOf(name);
    if (seen.has(id)) continue;
    seen.add(id);
    if (r.kind === "addon") addons++; else fullMeals++;
    // Add-ons stay in (a kitchen's sauce can match their sauce); name matching keeps drinks away from bowls.
    meals.push({ externalId: id, name: name.slice(0, 140), priceCents: cents, url: pages[0]?.url ?? null, portion: r.portion?.trim() || portionOf(name), estimated: true });
  }
  const note = [input.note?.trim() || null, fullMeals === 0 && addons > 0 ? `Only ${addons} add-on/snack prices are listed publicly, no full meals.` : null].filter(Boolean).join(" ") || null;
  return { items: meals, planOnly: meals.length === 0 && plans > 0, note };
}
