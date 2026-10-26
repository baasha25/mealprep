// DB side of nearby prices: refresh a competitor's items, rebuild suggestions,
// and load the per-meal comparison for the Profitability page.
import { db } from "@/lib/db";
import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import { fetchCompetitorPlans, comparePlans, type PlanRow, type CompPlan } from "@/lib/competitor-plans";
import { fetchCompetitorMenu, suggestFor, compare, positionLabel, parseManualPrices, MANUAL_PREFIX, isManualItem, type Comparison } from "@/lib/competitors";

export const MAX_COMPETITORS = 10;

/** Pull the latest menu for one competitor, upsert items, then rebuild suggestions for the kitchen. */
export async function refreshCompetitorData(competitorId: string, opts: { deadlineMs?: number } = {}): Promise<{ ok: boolean; items: number; plans?: number; error?: string }> {
  const comp = await db.competitor.findUnique({ where: { id: competitorId }, select: { id: true, businessId: true, domain: true } });
  if (!comp) return { ok: false, items: 0, plans: 0, error: "Not found" };
  const startedAt = Date.now();
  const res = await fetchCompetitorMenu(comp.domain, { deadlineMs: opts.deadlineMs });
  if (!res.ok) {
    // Typed-in prices keep a site "ok" even when its pages can't be read.
    const typed = await db.competitorItem.count({ where: { competitorId: comp.id, active: true, externalId: { startsWith: MANUAL_PREFIX } } });
    if (typed > 0) {
      await db.competitor.update({ where: { id: comp.id }, data: { status: "ok", platform: "manual", lastError: `${res.error} Showing the ${typed} price${typed === 1 ? "" : "s"} you typed.`, lastCheckedAt: new Date() } });
      await refreshCompetitorPlans(comp.id, comp.domain, Math.max(20_000, (opts.deadlineMs ?? 75_000) - (Date.now() - startedAt)));
      return { ok: true, items: typed, plans: 0 };
    }
    await db.competitor.update({ where: { id: comp.id }, data: { status: res.platform === "unsupported" ? "unsupported" : "error", platform: res.platform === "unsupported" ? "unsupported" : undefined, lastError: res.error, lastCheckedAt: new Date() } });
    // Plan-only sellers (CookUnity, many Sprwt kitchens) still have plan pricing worth reading.
    const plans = await refreshCompetitorPlans(comp.id, comp.domain, Math.max(20_000, (opts.deadlineMs ?? 75_000) - (Date.now() - startedAt)));
    if (plans > 0) {
      await db.competitor.update({ where: { id: comp.id }, data: { status: "ok", platform: "ai-plans", lastError: `${res.error} Weekly plan pricing was read instead (${plans} plan size${plans === 1 ? "" : "s"}).` } });
      return { ok: true, items: 0, plans, error: undefined };
    }
    return { ok: false, items: 0, plans: 0, error: res.error };
  }
  const now = new Date();
  const seen = new Set<string>();
  for (const it of res.items) {
    seen.add(it.externalId);
    await db.competitorItem.upsert({
      where: { competitorId_externalId: { competitorId: comp.id, externalId: it.externalId } },
      create: { competitorId: comp.id, externalId: it.externalId, name: it.name, priceCents: it.priceCents, url: it.url, portion: it.portion, estimated: Boolean(it.estimated), active: true, seenAt: now },
      update: { name: it.name, priceCents: it.priceCents, url: it.url, portion: it.portion, estimated: Boolean(it.estimated), active: true, seenAt: now },
    });
  }
  // Items that vanished from their menu stop counting (history kept).
  await db.competitorItem.updateMany({ where: { competitorId: comp.id, externalId: { notIn: [...seen], not: { startsWith: MANUAL_PREFIX } } }, data: { active: false } });
  await db.competitor.update({ where: { id: comp.id }, data: { platform: res.platform, status: "ok", lastError: res.note ?? null, lastCheckedAt: now } });
  await rebuildSuggestions(comp.businessId);
  const plans = await refreshCompetitorPlans(comp.id, comp.domain, Math.max(20_000, (opts.deadlineMs ?? 75_000) - (Date.now() - startedAt)));
  return { ok: true, items: res.items.length, plans };
}

/**
 * Weekly-plan pricing is read with its own AI call (when the key is set) and
 * kept apart from dish items. Failure here never fails the dish refresh.
 */
export async function refreshCompetitorPlans(competitorId: string, domain: string, deadlineMs: number): Promise<number> {
  if (!ANTHROPIC_ENABLED) return 0;
  try {
    const r = await fetchCompetitorPlans(domain, { deadlineMs });
    if (!r.ok) return 0;
    const now = new Date();
    for (const p of r.plans) {
      await db.competitorPlan.upsert({
        where: { competitorId_mealsPerWeek: { competitorId, mealsPerWeek: p.mealsPerWeek } },
        create: { competitorId, mealsPerWeek: p.mealsPerWeek, perMealCents: p.perMealCents, deliveryFeeCents: p.deliveryFeeCents, label: p.label, startingFrom: p.startingFrom, url: p.url, estimated: true, active: true, seenAt: now },
        update: { perMealCents: p.perMealCents, deliveryFeeCents: p.deliveryFeeCents, label: p.label, startingFrom: p.startingFrom, url: p.url, active: true, seenAt: now },
      });
    }
    await db.competitorPlan.updateMany({ where: { competitorId, mealsPerWeek: { notIn: r.plans.map((p) => p.mealsPerWeek) } }, data: { active: false } });
    return r.plans.length;
  } catch (err) {
    console.error("[competitors] plan refresh failed:", err);
    return 0;
  }
}

/**
 * Cron: refresh the stalest competitors within a wall-clock budget. AI reads can
 * take 20–60 s each, so one run may not cover everyone; the schedule is daily
 * and anything checked in the last `minAgeDays` is skipped, so the backlog
 * drains across the week without any single run timing out.
 */
export async function refreshStaleCompetitors(opts: { budgetMs: number; minAgeDays?: number; max?: number }): Promise<{ attempted: number; ok: number; failed: number; skipped: number }> {
  const started = Date.now();
  const cutoff = new Date(Date.now() - (opts.minAgeDays ?? 6) * 86_400_000);
  const comps = await db.competitor.findMany({
    where: { status: { not: "unsupported" }, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }] },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    select: { id: true },
    take: opts.max ?? 100,
  });
  let ok = 0, failed = 0, attempted = 0;
  for (const c of comps) {
    const left = opts.budgetMs - (Date.now() - started);
    if (left < 15_000) break;
    attempted++;
    const r = await refreshCompetitorData(c.id, { deadlineMs: Math.min(75_000, left - 5_000) });
    if (r.ok) ok++; else failed++;
  }
  return { attempted, ok, failed, skipped: comps.length - attempted };
}

/** Save prices the owner typed for a competitor (one dish per line); replaces earlier typed prices for that site. */
export async function saveManualPrices(competitorId: string, text: string): Promise<{ ok: boolean; items: number; skipped: string[]; error?: string }> {
  const comp = await db.competitor.findUnique({ where: { id: competitorId }, select: { id: true, businessId: true, status: true, platform: true } });
  if (!comp) return { ok: false, items: 0, skipped: [], error: "Not found" };
  const { items, skipped } = parseManualPrices(text);
  if (items.length === 0 && text.trim()) return { ok: false, items: 0, skipped, error: "No prices found — write one dish per line, like 'Chicken Teriyaki Bowl — 13.99'." };
  const now = new Date();
  for (const it of items) {
    await db.competitorItem.upsert({
      where: { competitorId_externalId: { competitorId: comp.id, externalId: it.externalId } },
      create: { competitorId: comp.id, externalId: it.externalId, name: it.name, priceCents: it.priceCents, url: null, portion: it.portion, estimated: false, active: true, seenAt: now },
      update: { name: it.name, priceCents: it.priceCents, portion: it.portion, estimated: false, active: true, seenAt: now },
    });
  }
  await db.competitorItem.updateMany({ where: { competitorId: comp.id, externalId: { startsWith: MANUAL_PREFIX, notIn: items.map((i) => i.externalId) } }, data: { active: false } });
  if (comp.status !== "ok" || comp.platform === "manual") {
    await db.competitor.update({ where: { id: comp.id }, data: items.length ? { status: "ok", platform: "manual", lastCheckedAt: now, lastError: null } : { status: comp.platform === "manual" ? "unsupported" : comp.status, platform: comp.platform === "manual" ? "unsupported" : comp.platform } });
  }
  await rebuildSuggestions(comp.businessId);
  return { ok: true, items: items.length, skipped };
}

/** Propose matches for every active meal against every active competitor item; never touches confirmed/dismissed rows. */
export async function rebuildSuggestions(businessId: string): Promise<number> {
  const [meals, items, existing] = await Promise.all([
    db.meal.findMany({ where: { businessId, active: true }, select: { id: true, name: true } }),
    db.competitorItem.findMany({ where: { active: true, competitor: { businessId } }, select: { id: true, name: true } }),
    db.competitorMatch.findMany({ where: { businessId }, select: { mealId: true, competitorItemId: true } }),
  ]);
  const have = new Set(existing.map((m) => `${m.mealId}:${m.competitorItemId}`));
  let created = 0;
  for (const meal of meals) {
    for (const s of suggestFor(meal.name, items)) {
      const key = `${meal.id}:${s.item.id}`;
      if (have.has(key)) continue;
      await db.competitorMatch.create({ data: { businessId, mealId: meal.id, competitorItemId: s.item.id, status: "suggested", score: s.score } });
      have.add(key); created++;
    }
  }
  return created;
}

export type NearbyCompetitor = { id: string; name: string; domain: string; platform: string | null; status: string; lastCheckedAt: Date | null; lastError: string | null; itemCount: number; planCount: number; typedLines: string };
export type { PlanRow };
export type NearbyMatch = { id: string; status: string; score: number; itemName: string; priceCents: number; portion: string | null; url: string | null; competitorName: string; estimated: boolean; typed: boolean };
export type NearbyRow = { mealId: string; name: string; priceCents: number; matches: NearbyMatch[]; comparison: Comparison; position: ReturnType<typeof positionLabel> };

export async function loadNearbyPrices(businessId: string): Promise<{ competitors: NearbyCompetitor[]; rows: NearbyRow[]; planRows: PlanRow[]; suggestedCount: number }> {
  const [comps, meals, matches, yourPlans, compPlans, typedItems] = await Promise.all([
    db.competitor.findMany({ where: { businessId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, domain: true, platform: true, status: true, lastCheckedAt: true, lastError: true, _count: { select: { items: { where: { active: true } }, plans: { where: { active: true } } } } } }),
    db.meal.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, priceCents: true } }),
    db.competitorMatch.findMany({ where: { businessId, status: { in: ["suggested", "confirmed"] }, item: { active: true } }, select: { id: true, mealId: true, status: true, score: true, item: { select: { name: true, priceCents: true, portion: true, url: true, estimated: true, externalId: true, competitor: { select: { name: true } } } } } }),
    db.plan.findMany({ where: { businessId, active: true }, orderBy: { mealsPerWeek: "asc" }, select: { id: true, name: true, mealsPerWeek: true, perMealPriceCents: true } }),
    db.competitorPlan.findMany({ where: { active: true, competitor: { businessId } }, select: { mealsPerWeek: true, perMealCents: true, startingFrom: true, estimated: true, label: true, url: true, competitor: { select: { name: true } } } }),
    db.competitorItem.findMany({ where: { active: true, externalId: { startsWith: MANUAL_PREFIX }, competitor: { businessId } }, orderBy: { name: "asc" }, select: { competitorId: true, name: true, priceCents: true } }),
  ]);
  const typedByComp = new Map<string, string[]>();
  for (const t of typedItems) typedByComp.set(t.competitorId, [...(typedByComp.get(t.competitorId) ?? []), `${t.name} — ${(t.priceCents / 100).toFixed(2)}`]);
  const byMeal = new Map<string, NearbyMatch[]>();
  for (const m of matches) {
    const arr = byMeal.get(m.mealId) ?? [];
    arr.push({ id: m.id, status: m.status, score: m.score, itemName: m.item.name, priceCents: m.item.priceCents, portion: m.item.portion, url: m.item.url, competitorName: m.item.competitor.name, estimated: m.item.estimated, typed: isManualItem(m.item.externalId) });
    byMeal.set(m.mealId, arr);
  }
  const rows: NearbyRow[] = meals.map((meal) => {
    const ms = (byMeal.get(meal.id) ?? []).sort((a, b) => (a.status === b.status ? b.score - a.score : a.status === "confirmed" ? -1 : 1));
    const cmp = compare(meal.priceCents, ms.filter((x) => x.status === "confirmed").map((x) => x.priceCents));
    return { mealId: meal.id, name: meal.name, priceCents: meal.priceCents, matches: ms, comparison: cmp, position: positionLabel(cmp.vsMedianPct) };
  });
  const planRows = comparePlans(
    yourPlans,
    compPlans.map((p): CompPlan => ({ competitorName: p.competitor.name, mealsPerWeek: p.mealsPerWeek, perMealCents: p.perMealCents, startingFrom: p.startingFrom, estimated: p.estimated, label: p.label, url: p.url })),
  );
  return {
    competitors: comps.map((c) => ({ id: c.id, name: c.name, domain: c.domain, platform: c.platform, status: c.status, lastCheckedAt: c.lastCheckedAt, lastError: c.lastError, itemCount: c._count.items, planCount: c._count.plans, typedLines: (typedByComp.get(c.id) ?? []).join("\n") })),
    rows,
    planRows,
    suggestedCount: matches.filter((m) => m.status === "suggested").length,
  };
}
