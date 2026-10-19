"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { effectiveTier, type TierKey } from "@/lib/tiers";
import { rateLimit } from "@/lib/ratelimit";
import { normalizeDomain } from "@/lib/competitors";
import { refreshCompetitorData, MAX_COMPETITORS } from "@/lib/competitors-data";
import ontario from "@/data/ontario-kitchens.json";

export type CompResult = { ok: boolean; message: string };

async function proOwner() {
  const ctx = await requireOwner();
  const pro = effectiveTier({ tier: ctx.business.tier as TierKey, trialEndsAt: ctx.business.trialEndsAt }) === "pro";
  return { ...ctx, pro };
}

/** Watch a competitor by URL or domain, fetch their menu, and propose matches. */
export async function addCompetitor(input: { url: string; name?: string }): Promise<CompResult> {
  const { business, pro } = await proOwner();
  if (!pro) return { ok: false, message: "Nearby prices is part of the Pro plan." };
  if (!(await rateLimit("competitor-add", business.id, 10, "1 h")).ok) return { ok: false, message: "Too many additions this hour. Try again later." };
  const domain = normalizeDomain(input.url);
  if (!domain) return { ok: false, message: "Enter the competitor's website, e.g. powerkitchen.ca." };
  const count = await db.competitor.count({ where: { businessId: business.id } });
  if (count >= MAX_COMPETITORS) return { ok: false, message: `You can watch up to ${MAX_COMPETITORS} competitors. Remove one to add another.` };
  const known = (ontario as { name: string; domain: string }[]).find((k) => k.domain === domain);
  const name = (input.name || known?.name || domain.replace(/\.(ca|com|co|net|org)$/, "").replace(/[-.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())).slice(0, 80);
  let comp;
  try {
    comp = await db.competitor.create({ data: { businessId: business.id, name, domain, url: `https://${domain}` } });
  } catch {
    return { ok: false, message: "You're already watching that site." };
  }
  const r = await refreshCompetitorData(comp.id);
  revalidatePath("/dashboard/profitability");
  if (!r.ok) return { ok: false, message: `Added ${name}, but: ${r.error}` };
  return { ok: true, message: readSummary(name, r.items, r.plans ?? 0) };
}

export async function refreshCompetitor(id: string): Promise<CompResult> {
  const { business, pro } = await proOwner();
  if (!pro) return { ok: false, message: "Nearby prices is part of the Pro plan." };
  if (!(await rateLimit("competitor-refresh", business.id, 20, "1 h")).ok) return { ok: false, message: "Too many refreshes this hour." };
  const comp = await db.competitor.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!comp) return { ok: false, message: "Not found." };
  const r = await refreshCompetitorData(comp.id);
  revalidatePath("/dashboard/profitability");
  return r.ok ? { ok: true, message: readSummary("Refreshed", r.items, r.plans ?? 0) } : { ok: false, message: r.error ?? "Could not read their menu." };
}

export async function removeCompetitor(id: string): Promise<CompResult> {
  const { business } = await proOwner();
  await db.competitor.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/dashboard/profitability");
  return { ok: true, message: "Removed." };
}

export async function setMatchStatus(matchId: string, status: "confirmed" | "dismissed"): Promise<CompResult> {
  const { business } = await proOwner();
  const r = await db.competitorMatch.updateMany({ where: { id: matchId, businessId: business.id }, data: { status } });
  revalidatePath("/dashboard/profitability");
  return r.count ? { ok: true, message: status === "confirmed" ? "Matched." : "Dismissed." } : { ok: false, message: "Not found." };
}

/** "Name: 18 items read and 3 plan prices." — honest about plan-only sellers. */
function readSummary(name: string, items: number, plans: number): string {
  const parts: string[] = [];
  if (items) parts.push(`${items} item${items === 1 ? "" : "s"} read`);
  if (plans) parts.push(`${plans} plan price${plans === 1 ? "" : "s"} read`);
  if (!items && !plans) return `${name}: nothing priced was found on their public pages.`;
  const tail = items ? " Suggested matches are waiting for your confirm." : " They don't publish dish prices, so see 'Weekly plans vs nearby'.";
  return `${name}: ${parts.join(" and ")}.${tail}`;
}
