// DB side of nearby prices: refresh a competitor's items, rebuild suggestions,
// and load the per-meal comparison for the Profitability page.
import { db } from "@/lib/db";
import { fetchCompetitorMenu, suggestFor, compare, positionLabel, type Comparison } from "@/lib/competitors";

export const MAX_COMPETITORS = 10;

/** Pull the latest menu for one competitor, upsert items, then rebuild suggestions for the kitchen. */
export async function refreshCompetitorData(competitorId: string): Promise<{ ok: boolean; items: number; error?: string }> {
  const comp = await db.competitor.findUnique({ where: { id: competitorId }, select: { id: true, businessId: true, domain: true } });
  if (!comp) return { ok: false, items: 0, error: "Not found" };
  const res = await fetchCompetitorMenu(comp.domain);
  if (!res.ok) {
    await db.competitor.update({ where: { id: comp.id }, data: { status: res.platform === "unsupported" ? "unsupported" : "error", platform: res.platform === "unsupported" ? "unsupported" : undefined, lastError: res.error, lastCheckedAt: new Date() } });
    return { ok: false, items: 0, error: res.error };
  }
  const now = new Date();
  const seen = new Set<string>();
  for (const it of res.items) {
    seen.add(it.externalId);
    await db.competitorItem.upsert({
      where: { competitorId_externalId: { competitorId: comp.id, externalId: it.externalId } },
      create: { competitorId: comp.id, externalId: it.externalId, name: it.name, priceCents: it.priceCents, url: it.url, portion: it.portion, active: true, seenAt: now },
      update: { name: it.name, priceCents: it.priceCents, url: it.url, portion: it.portion, active: true, seenAt: now },
    });
  }
  // Items that vanished from their menu stop counting (history kept).
  await db.competitorItem.updateMany({ where: { competitorId: comp.id, externalId: { notIn: [...seen] } }, data: { active: false } });
  await db.competitor.update({ where: { id: comp.id }, data: { platform: res.platform, status: "ok", lastError: null, lastCheckedAt: now } });
  await rebuildSuggestions(comp.businessId);
  return { ok: true, items: res.items.length };
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

export type NearbyCompetitor = { id: string; name: string; domain: string; platform: string | null; status: string; lastCheckedAt: Date | null; lastError: string | null; itemCount: number };
export type NearbyMatch = { id: string; status: string; score: number; itemName: string; priceCents: number; portion: string | null; url: string | null; competitorName: string };
export type NearbyRow = { mealId: string; name: string; priceCents: number; matches: NearbyMatch[]; comparison: Comparison; position: ReturnType<typeof positionLabel> };

export async function loadNearbyPrices(businessId: string): Promise<{ competitors: NearbyCompetitor[]; rows: NearbyRow[]; suggestedCount: number }> {
  const [comps, meals, matches] = await Promise.all([
    db.competitor.findMany({ where: { businessId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, domain: true, platform: true, status: true, lastCheckedAt: true, lastError: true, _count: { select: { items: { where: { active: true } } } } } }),
    db.meal.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, priceCents: true } }),
    db.competitorMatch.findMany({ where: { businessId, status: { in: ["suggested", "confirmed"] }, item: { active: true } }, select: { id: true, mealId: true, status: true, score: true, item: { select: { name: true, priceCents: true, portion: true, url: true, competitor: { select: { name: true } } } } } }),
  ]);
  const byMeal = new Map<string, NearbyMatch[]>();
  for (const m of matches) {
    const arr = byMeal.get(m.mealId) ?? [];
    arr.push({ id: m.id, status: m.status, score: m.score, itemName: m.item.name, priceCents: m.item.priceCents, portion: m.item.portion, url: m.item.url, competitorName: m.item.competitor.name });
    byMeal.set(m.mealId, arr);
  }
  const rows: NearbyRow[] = meals.map((meal) => {
    const ms = (byMeal.get(meal.id) ?? []).sort((a, b) => (a.status === b.status ? b.score - a.score : a.status === "confirmed" ? -1 : 1));
    const cmp = compare(meal.priceCents, ms.filter((x) => x.status === "confirmed").map((x) => x.priceCents));
    return { mealId: meal.id, name: meal.name, priceCents: meal.priceCents, matches: ms, comparison: cmp, position: positionLabel(cmp.vsMedianPct) };
  });
  return {
    competitors: comps.map((c) => ({ id: c.id, name: c.name, domain: c.domain, platform: c.platform, status: c.status, lastCheckedAt: c.lastCheckedAt, lastError: c.lastError, itemCount: c._count.items })),
    rows,
    suggestedCount: matches.filter((m) => m.status === "suggested").length,
  };
}
