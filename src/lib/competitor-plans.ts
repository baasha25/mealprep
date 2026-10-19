// Nearby prices — weekly PLAN pricing (per-meal price by plan size).
//
// Subscription sellers (CookUnity, Goodfood, most Sprwt kitchens) never price a
// dish on its own; they publish "$12.49/meal on the 6-meal plan". That is a
// different question from the per-plate comparison, so it is read, stored and
// shown separately: the kitchen's Meal Plans vs competitors' plans of the same
// size. Everything here comes from page text via Claude and is marked estimated.

import { ANTHROPIC_ENABLED, getAnthropic } from "@/lib/anthropic";
import { fetchText, mapLimit, htmlToText, findMenuLinks, renderedFetchUrl, toCents } from "@/lib/competitor-readers";
import { compare, positionLabel, type Comparison } from "@/lib/competitors";

export type FetchedPlan = { mealsPerWeek: number; perMealCents: number; deliveryFeeCents: number | null; label: string | null; startingFrom: boolean; url: string | null };
export type PlanFetchResult = { ok: true; plans: FetchedPlan[]; note: string | null } | { ok: false; error: string };

/* ─────────────── pure ─────────────── */

/** "6 meals / week", "6-meal plan", "Plan of 8" → 6 / 6 / 8; null when absent. */
export function parsePlanSize(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = label.match(/(\d{1,2})\s*(?:-|\s)?\s*(meals?|dishes|plates|boxes|items|servings|entr[ée]es)\b/i) ?? label.match(/\b(?:plan|box|pack) of (\d{1,2})\b/i) ?? label.match(/^\s*(\d{1,2})\s*$/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 2 && n <= 40 ? n : null;
}

export type RawPlanRow = { label?: string | null; mealsPerWeek?: number | null; perMealPrice?: number | null; weeklyTotal?: number | null; deliveryFee?: number | null; startingFrom?: boolean | null };

/** Turn Claude's rows into clean plans: one per size, sane per-meal price, derived from the weekly total when needed. */
export function normalizePlanRows(rows: RawPlanRow[], url: string | null): FetchedPlan[] {
  const bySize = new Map<number, FetchedPlan>();
  for (const r of rows) {
    const size = (typeof r.mealsPerWeek === "number" && r.mealsPerWeek >= 2 && r.mealsPerWeek <= 40 ? Math.round(r.mealsPerWeek) : null) ?? parsePlanSize(r.label);
    if (!size) continue;
    let perMeal = toCents(r.perMealPrice ?? undefined);
    if (!perMeal && r.weeklyTotal && r.weeklyTotal > 0) perMeal = Math.round((r.weeklyTotal * 100) / size);
    if (!perMeal || perMeal < 300 || perMeal > 6000) continue; // $3–$60 a meal is the believable band
    const fee = r.deliveryFee == null ? null : toCents(r.deliveryFee) ?? (r.deliveryFee === 0 ? 0 : null);
    const plan: FetchedPlan = { mealsPerWeek: size, perMealCents: perMeal, deliveryFeeCents: fee, label: r.label?.trim().slice(0, 80) || null, startingFrom: Boolean(r.startingFrom), url };
    const prev = bySize.get(size);
    if (!prev || plan.perMealCents < prev.perMealCents) bySize.set(size, plan); // several variants of one size: keep the cheapest listed
  }
  return [...bySize.values()].sort((a, b) => a.mealsPerWeek - b.mealsPerWeek);
}

export type YourPlan = { id: string; name: string; mealsPerWeek: number; perMealPriceCents: number };
export type CompPlan = { competitorName: string; mealsPerWeek: number; perMealCents: number; startingFrom: boolean; estimated: boolean; label: string | null; url: string | null };
export type PlanRow = {
  plan: YourPlan;
  comps: (CompPlan & { nearestSize: boolean })[];
  comparison: Comparison;
  position: ReturnType<typeof positionLabel>;
};

/**
 * Compare each of the kitchen's plans against competitor plans of the SAME
 * size; when a competitor has no plan of that size, its nearest size within
 * ±2 meals is used and flagged, so a 6-meal plan is never judged against a
 * 16-meal headline price.
 */
export function comparePlans(yours: YourPlan[], comps: CompPlan[]): PlanRow[] {
  return yours.map((plan) => {
    const picked: (CompPlan & { nearestSize: boolean })[] = [];
    const byComp = new Map<string, CompPlan[]>();
    for (const c of comps) byComp.set(c.competitorName, [...(byComp.get(c.competitorName) ?? []), c]);
    for (const list of byComp.values()) {
      const exact = list.find((c) => c.mealsPerWeek === plan.mealsPerWeek);
      if (exact) { picked.push({ ...exact, nearestSize: false }); continue; }
      const near = list
        .filter((c) => Math.abs(c.mealsPerWeek - plan.mealsPerWeek) <= 2)
        .sort((a, b) => Math.abs(a.mealsPerWeek - plan.mealsPerWeek) - Math.abs(b.mealsPerWeek - plan.mealsPerWeek) || a.perMealCents - b.perMealCents)[0];
      if (near) picked.push({ ...near, nearestSize: true });
    }
    picked.sort((a, b) => a.perMealCents - b.perMealCents);
    const cmp = compare(plan.perMealPriceCents, picked.map((c) => c.perMealCents));
    return { plan, comps: picked, comparison: cmp, position: positionLabel(cmp.vsMedianPct) };
  });
}

const PLAN_HINT = /per meal|\/\s?meal|a meal|each meal|per serving|\/\s?serving|meals?\s*(?:\/|per)\s*week|plan/i;
export function planMentions(text: string): number {
  return (text.match(new RegExp(PLAN_HINT.source, "gi")) ?? []).length;
}

/* ─────────────── IO ─────────────── */

const PLAN_TOOL = {
  name: "record_plan_prices",
  description: "Record the weekly subscription / meal-plan pricing published on this storefront.",
  input_schema: {
    type: "object" as const,
    properties: {
      plans: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: ["string", "null"], description: "Their name for the plan, e.g. '6 meals / week' or 'Family'." },
            mealsPerWeek: { type: ["integer", "null"], description: "Meals included per week/delivery, if stated." },
            perMealPrice: { type: ["number", "null"], description: "Price per meal in dollars for this plan size, if stated (e.g. 12.49)." },
            weeklyTotal: { type: ["number", "null"], description: "Total price per week/delivery in dollars, if stated instead of a per-meal price." },
            deliveryFee: { type: ["number", "null"], description: "Delivery/shipping fee in dollars if stated; 0 if stated as free; null if not mentioned." },
            startingFrom: { type: "boolean", description: "true when the price is a 'from'/'as low as' figure or depends on location." },
          },
          required: ["startingFrom"],
        },
      },
      note: { type: ["string", "null"], description: "One short sentence on how pricing is presented (e.g. 'per-meal price drops with plan size; exact price shown after postal code'), else null." },
    },
    required: ["plans"],
  },
};

/** Read a competitor's plan pricing from its pages. Needs the Anthropic key; honest failures otherwise. */
export async function fetchCompetitorPlans(domain: string, opts: { deadlineMs?: number } = {}): Promise<PlanFetchResult> {
  if (!ANTHROPIC_ENABLED) return { ok: false, error: "AI reading isn't switched on (needs the Anthropic key)." };
  const started = Date.now();
  const left = () => Math.max(1500, (opts.deadlineMs ?? 60_000) - (Date.now() - started));
  const base = `https://${domain}`;
  const home = await fetchText(base, { timeoutMs: Math.min(15_000, left()), browserUa: true });
  if (!home || home.status >= 400) return { ok: false, error: home ? `Their site answered ${home.status}.` : "Couldn't reach their site." };

  // Pricing-ish pages first, then menu-ish ones; the home page always included.
  const links = Array.from(home.text.matchAll(/href=["']([^"'#]+)["']/gi), (m) => m[1])
    .map((h) => { try { return new URL(h, home.finalUrl); } catch { return null; } })
    .filter((u): u is URL => Boolean(u && u.hostname.replace(/^www\./, "") === new URL(home.finalUrl).hostname.replace(/^www\./, "")))
    .filter((u) => /pric|plan|subscri|how-it-works|howitworks|membership|bundle/i.test(u.pathname))
    .map((u) => u.origin + u.pathname);
  const candidates = [...new Set([home.finalUrl, ...links, ...findMenuLinks(home.text, home.finalUrl, 2)])].slice(0, 4);
  const fetched = await mapLimit(candidates, 3, async (u) => (u === home.finalUrl ? home : await fetchText(u, { timeoutMs: Math.min(12_000, left()), browserUa: true })));
  let pages = fetched.map((p, i) => ({ url: candidates[i], text: p && p.status === 200 ? htmlToText(p.text, 20_000) : "" })).filter((p) => p.text);
  if (pages.reduce((n, p) => n + planMentions(p.text), 0) < 2) {
    const rendered = await mapLimit(candidates.slice(0, 2), 2, (u) => fetchText(renderedFetchUrl(u), { timeoutMs: Math.min(40_000, left()), accept: "text/plain", headers: { "x-return-format": "text", ...(process.env.JINA_API_KEY ? { authorization: `Bearer ${process.env.JINA_API_KEY}` } : {}) } }));
    const rp = rendered.map((p, i) => ({ url: candidates[i], text: p && p.status === 200 ? p.text.slice(0, 20_000) : "" })).filter((p) => planMentions(p.text) > 0);
    if (rp.length) pages = rp;
  }
  if (!pages.length) return { ok: false, error: "No plan pricing on their public pages." };

  try {
    const anthropic = getAnthropic();
    const body = pages.map((p) => `=== PAGE ${p.url} ===\n${p.text}`).join("\n\n").slice(0, 50_000);
    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      tools: [PLAN_TOOL],
      tool_choice: { type: "tool", name: "record_plan_prices" },
      system:
        "You extract published weekly meal-plan / subscription pricing from storefront page text. Record one row per plan size that has a stated price (per meal or per week). Only what the text says: never compute a per-meal price unless the weekly total and the meal count are both stated (then give weeklyTotal and mealsPerWeek and leave perMealPrice null). Mark startingFrom=true for 'from', 'as low as', or location-dependent prices. Ignore meal kits you must cook yourself only if the site clearly says so; ignore gift cards, credits and promo codes. Currency is CAD unless the page says otherwise.",
      messages: [{ role: "user", content: `Site: ${domain}\n\n${body}` }],
    });
    const tool = message.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return { ok: false, error: "No structured answer." };
    const input = tool.input as { plans?: RawPlanRow[]; note?: string | null };
    const plans = normalizePlanRows(Array.isArray(input.plans) ? input.plans : [], pages[0]?.url ?? null);
    if (!plans.length) return { ok: false, error: input.note?.trim() || "No plan pricing with a stated price on their public pages." };
    return { ok: true, plans, note: input.note?.trim() || null };
  } catch (err) {
    console.error("[competitor-plans] AI read failed:", err);
    return { ok: false, error: "The AI read failed this time." };
  }
}
