"use client";

import { useState, useTransition } from "react";
import { MapPin, RefreshCw, Trash2, Check, X, ExternalLink, Lock, ChevronDown, ChevronUp, PencilLine } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { Hint } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { READ_METHOD_LABEL, isEstimatedMethod } from "@/lib/competitors";
import { addCompetitor, refreshCompetitor, removeCompetitor, setMatchStatus, typeCompetitorPrices } from "./competitor-actions";
import type { NearbyCompetitor, NearbyRow, PlanRow } from "@/lib/competitors-data";

// Subscription services customers quote by name; they publish plan pricing, not dish prices.
const NATIONAL: { name: string; domain: string }[] = [
  { name: "CookUnity", domain: "cookunity.com" },
  { name: "Goodfood", domain: "makegoodfood.ca" },
];

type Suggestion = { name: string; domain: string; city: string; region: string; platform: string; province?: string };

export function NearbyPrices({ competitors, rows, planRows, suggestedCount, isPro, suggestions, defaultRegion }: { competitors: NearbyCompetitor[]; rows: NearbyRow[]; planRows: PlanRow[]; suggestedCount: number; isPro: boolean; suggestions: Suggestion[]; defaultRegion: string }) {
  const [openPlan, setOpenPlan] = useState<Record<string, boolean>>({});
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [region, setRegion] = useState(defaultRegion);
  const [typing, setTyping] = useState<{ id: string; text: string } | null>(null);
  const watched = new Set(competitors.map((c) => c.domain));
  const regions = [...new Set(suggestions.map((s) => s.region))];
  const nearby = suggestions.filter((s) => s.region === region && !watched.has(s.domain)).slice(0, 8);
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.message }); });
  const tone = (t: string) => (t === "under" ? "var(--clay)" : t === "over" ? "#8a6d1f" : t === "inline" ? "var(--pine)" : "var(--muted)");

  if (!isPro) {
    return (
      <Card className="mb-5">
        <CardTitle icon={<MapPin size={15} />} title="Nearby prices" note="Pro plan" />
        <div className="flex items-start gap-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
          <Lock size={16} style={{ color: "var(--muted)", marginTop: 2 }} />
          <p>See what kitchens near you list similar meals for, matched to your menu, with a link to each price and the date we checked. Pick the competitors you care about; we re-read their public menus every week. Included in the Pro plan.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5">
      <CardTitle icon={<MapPin size={15} />} title="Nearby prices" note={`Public listed prices · ${competitors.length} watched${suggestedCount ? ` · ${suggestedCount} matches to confirm` : ""}`} />
      <p className="text-[12px] mb-3 -mt-2" style={{ color: "var(--muted)" }}>
        We read competitors&apos; public menus (names, prices, links; nothing else) weekly and suggest matches for your meals. Shopify, WooCommerce, Wix, Square and Squarespace stores are read exactly; other sites are read from the page by AI and marked ≈ estimated. Confirm the ones that are really the same dish; only confirmed matches count.
      </p>

      {/* Watched competitors */}
      <div className="flex flex-wrap gap-2 mb-3">
        {competitors.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12px]" style={{ borderColor: c.status === "ok" ? "var(--line)" : "var(--clay)", background: "var(--paper)" }} title={c.lastError ?? ""}>
            <span className="font-medium" style={{ color: "var(--ink)" }}>{c.name}</span>
            <span style={{ color: "var(--muted)" }}>{c.status === "ok" ? `${c.itemCount ? `${c.itemCount} items` : ""}${c.itemCount && c.planCount ? " · " : ""}${c.planCount ? `${c.planCount} plan${c.planCount === 1 ? "" : "s"}` : ""}${!c.itemCount && !c.planCount ? "0 items" : ""} · ${c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}` : c.status === "unsupported" ? "can't read yet" : "error"}</span>
            {c.status === "ok" && c.platform && (
              <span className="text-[10.5px] px-1.5 py-px rounded" title={isEstimatedMethod(c.platform) ? "Prices were read from the page text by AI, not from a structured feed — treat as estimates (≈)." : `Read from their ${READ_METHOD_LABEL[c.platform] ?? c.platform} — exact listed prices.`} style={{ background: isEstimatedMethod(c.platform) ? "#f3e9c9" : "var(--sand)", color: isEstimatedMethod(c.platform) ? "#8a6d1f" : "var(--muted)" }}>
                {isEstimatedMethod(c.platform) ? "≈ AI-read" : READ_METHOD_LABEL[c.platform] ?? c.platform}
              </span>
            )}
            <button type="button" onClick={() => setTyping(typing?.id === c.id ? null : { id: c.id, text: c.typedLines })} disabled={pending} title={c.status === "ok" ? "Type prices from their menu yourself" : "We couldn't read this site — type a few prices from their menu and they'll count like any other"} className="inline-flex items-center gap-1 text-[11px]" style={{ color: c.status === "ok" ? "var(--muted)" : "var(--clay)" }}><PencilLine size={12} />{c.status === "ok" ? null : <span>type prices</span>}</button>
            <button type="button" onClick={() => run(() => refreshCompetitor(c.id))} disabled={pending} title="Refresh" style={{ color: "var(--muted)" }}><RefreshCw size={12} /></button>
            <button type="button" onClick={() => run(() => removeCompetitor(c.id))} disabled={pending} title="Stop watching" style={{ color: "var(--muted)" }}><Trash2 size={12} /></button>
          </div>
        ))}
        {competitors.length === 0 && <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>No competitors watched yet.</span>}
      </div>

      {typing && (() => {
        const c = competitors.find((x) => x.id === typing.id);
        return c ? (
          <div className="rounded-lg border p-3 mb-3" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <div className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>Type {c.name}&apos;s prices</div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>One dish per line, price at the end · kept through weekly re-reads · counts as a listed price</div>
            </div>
            <textarea value={typing.text} onChange={(e) => setTyping({ id: c.id, text: e.target.value })} rows={5} placeholder={"Chicken Teriyaki Bowl — 13.99\nKeto Box (400g) $14\nSalmon & Rice 16.50"} className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none font-mono" style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
            <div className="flex items-center gap-2 mt-2">
              <button type="button" disabled={pending} onClick={() => run(async () => { const r = await typeCompetitorPrices(c.id, typing.text); if (r.ok) setTyping(null); return r; })} className="px-3 py-1.5 rounded-md text-[12.5px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{pending ? "Saving…" : "Save prices"}</button>
              <button type="button" onClick={() => setTyping(null)} className="px-3 py-1.5 rounded-md text-[12.5px] border" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>Cancel</button>
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>Clear the box and save to remove typed prices.</span>
            </div>
          </div>
        ) : null;
      })()}

      {/* Add by URL + nearby suggestions */}
      <form className="flex gap-2 mb-2" onSubmit={(e) => { e.preventDefault(); if (!url.trim()) return; run(async () => { const r = await addCompetitor({ url }); if (r.ok) setUrl(""); return r; }); }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Competitor website" className="flex-1 px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} />
        <button type="submit" disabled={pending} className="px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{pending ? "Reading…" : "Watch"}</button>
      </form>
      {nearby.length > 0 && (
        <div className="mb-4 text-[12px]" style={{ color: "var(--muted)" }}>
          <span>Kitchens near </span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded border px-1.5 py-0.5 text-[12px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span>: </span>
          {nearby.map((s) => (
            <button key={s.domain} type="button" disabled={pending} onClick={() => run(() => addCompetitor({ url: s.domain, name: s.name }))} className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-md border" style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }} title={`${s.city} · ${s.platform}`}>+ {s.name}</button>
          ))}
        </div>
      )}
      {NATIONAL.some((n) => !watched.has(n.domain)) && (
        <div className="mb-4 text-[12px]" style={{ color: "var(--muted)" }}>
          <span>Subscription services (plan pricing): </span>
          {NATIONAL.filter((n) => !watched.has(n.domain)).map((n) => (
            <button key={n.domain} type="button" disabled={pending} onClick={() => run(() => addCompetitor({ url: n.domain, name: n.name }))} className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-md border" style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }} title="Publishes per-meal prices by plan size, not dish prices">+ {n.name}</button>
          ))}
        </div>
      )}
      {msg && <p className="text-[12.5px] mb-3" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>{msg.text}</p>}

      {/* Per-meal comparison */}
      {competitors.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <div className="hidden sm:grid grid-cols-[1.5fr_80px_90px_150px_1fr_28px] gap-3 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", background: "var(--paper)" }}>
            <span>Your meal</span><span className="text-right">You</span><span className="text-right inline-flex items-center justify-end gap-1">Matches <Hint text="Competitor dishes you confirmed are the same dish. Only confirmed matches count toward the range." /></span><span className="text-right inline-flex items-center justify-end gap-1">Nearby range · median <Hint text="Lowest–highest confirmed nearby price, and the middle value. ≈ marks a price read from page text by AI." /></span><span className="inline-flex items-center gap-1">Position <Hint text="Where your price sits against the nearby median: in line (within about 5%), under, or over. A signal, not a verdict — portions differ." /></span><span />
          </div>
          {rows.map((r) => {
            const sug = r.matches.filter((m) => m.status === "suggested").length;
            const isOpen = open[r.mealId] ?? sug > 0;
            return (
              <div key={r.mealId} style={{ borderTop: "1px solid var(--line)" }}>
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [r.mealId]: !isOpen }))} className="w-full grid sm:grid-cols-[1.5fr_80px_90px_150px_1fr_28px] grid-cols-2 gap-3 px-3 py-2.5 items-center text-left">
                  <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}</span>
                  <span className="text-[12.5px] text-right tabular-nums" style={{ color: "var(--ink)" }}>{formatCents(r.priceCents)}</span>
                  <span className="text-[12px] text-right" style={{ color: "var(--muted)" }}>{r.comparison.count} confirmed{sug ? ` · ${sug} new` : ""}</span>
                  <span className="text-[12px] text-right tabular-nums" style={{ color: "var(--ink-soft)" }}>{r.comparison.count ? `${formatCents(r.comparison.minCents)}–${formatCents(r.comparison.maxCents)} · ${formatCents(r.comparison.medianCents)}` : "—"}</span>
                  <span className="text-[12px] font-medium" style={{ color: tone(r.position.tone) }}>{r.position.label}</span>
                  <span style={{ color: "var(--muted)" }}>{r.matches.length ? (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}</span>
                </button>
                {isOpen && r.matches.length > 0 && (
                  <div className="px-3 pb-2.5 space-y-1.5">
                    {r.matches.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-[12.5px] px-2.5 py-1.5 rounded-md" style={{ background: m.status === "confirmed" ? "color-mix(in srgb, var(--pine) 7%, transparent)" : "var(--paper)" }}>
                        <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
                          <span style={{ color: "var(--muted)" }}>{m.competitorName}: </span>{m.itemName}{m.portion ? <span style={{ color: "var(--muted)" }}> · {m.portion}</span> : null}
                        </span>
                        <span className="tabular-nums font-medium" style={{ color: "var(--ink)" }} title={m.typed ? "Typed in by you from their menu" : m.estimated ? "Estimated: read from their page text by AI" : "Listed price from their structured feed"}>{m.estimated ? "≈ " : ""}{formatCents(m.priceCents)}</span>
                        {m.typed && <span className="text-[10.5px] px-1.5 py-px rounded" style={{ background: "var(--sand)", color: "var(--muted)" }}>typed</span>}
                        {m.url && <a href={m.url} target="_blank" rel="noreferrer noopener" title="Open their listing" style={{ color: "var(--muted)" }}><ExternalLink size={12} /></a>}
                        {m.status === "suggested" ? (
                          <>
                            <button type="button" disabled={pending} onClick={() => run(() => setMatchStatus(m.id, "confirmed"))} className="px-2 py-0.5 rounded-md text-[11.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}><Check size={11} className="inline" /> Same dish</button>
                            <button type="button" disabled={pending} onClick={() => run(() => setMatchStatus(m.id, "dismissed"))} className="px-2 py-0.5 rounded-md text-[11.5px] border" style={{ borderColor: "var(--line)", color: "var(--muted)" }}><X size={11} className="inline" /> Not it</button>
                          </>
                        ) : (
                          <button type="button" disabled={pending} onClick={() => run(() => setMatchStatus(m.id, "dismissed"))} className="text-[11.5px]" style={{ color: "var(--muted)" }}>unmatch</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Weekly plans vs nearby — the subscription question, kept apart from single plates */}
      {planRows.length > 0 && planRows.some((r) => r.comps.length > 0) && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between mb-1.5">
            <h4 className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Weekly plans vs nearby</h4>
            <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>per-meal price at the same plan size · ≈ read from their pricing page</span>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div className="grid grid-cols-[1.4fr_90px_1fr_1.4fr_110px_20px] gap-2 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
              <div>Your plan</div><div className="text-right">You / meal</div><div className="text-right inline-flex items-center justify-end gap-1">Plans found <Hint text="Competitors publishing a plan of this size. The nearest size within two meals is used when there is no exact match, and flagged." /></div><div className="text-right">Nearby range · median</div><div className="inline-flex items-center gap-1">Position <Hint text="Your per-meal plan price against the nearby median at the same plan size." /></div><div />
            </div>
            {planRows.map((r) => {
              const isOpen = openPlan[r.plan.id];
              return (
                <div key={r.plan.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <button type="button" onClick={() => setOpenPlan((o) => ({ ...o, [r.plan.id]: !o[r.plan.id] }))} className="w-full grid grid-cols-[1.4fr_90px_1fr_1.4fr_110px_20px] gap-2 px-3 py-2 items-center text-left">
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.plan.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {r.plan.mealsPerWeek} meals</span></span>
                    <span className="text-[13px] text-right tabular-nums" style={{ color: "var(--ink)" }}>{formatCents(r.plan.perMealPriceCents)}</span>
                    <span className="text-[12px] text-right" style={{ color: "var(--muted)" }}>{r.comps.length ? `${r.comps.length} competitor${r.comps.length === 1 ? "" : "s"}` : "none at this size"}</span>
                    <span className="text-[12px] text-right tabular-nums" style={{ color: "var(--ink-soft)" }}>{r.comparison.count ? `${formatCents(r.comparison.minCents)}–${formatCents(r.comparison.maxCents)} · ${formatCents(r.comparison.medianCents)}` : "—"}</span>
                    <span className="text-[12px] font-medium" style={{ color: tone(r.position.tone) }}>{r.comps.length ? r.position.label : "No competitor plan at this size"}</span>
                    <span style={{ color: "var(--muted)" }}>{r.comps.length ? (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}</span>
                  </button>
                  {isOpen && r.comps.length > 0 && (
                    <div className="px-3 pb-2.5 space-y-1.5">
                      {r.comps.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[12.5px] px-2.5 py-1.5 rounded-md" style={{ background: "var(--paper)" }}>
                          <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
                            <span style={{ color: "var(--muted)" }}>{c.competitorName}: </span>{c.label ?? `${c.mealsPerWeek} meals`}{c.nearestSize ? <span style={{ color: "#8a6d1f" }}> · nearest size ({c.mealsPerWeek})</span> : null}{c.startingFrom ? <span style={{ color: "var(--muted)" }}> · &lsquo;from&rsquo; price</span> : null}
                          </span>
                          <span className="tabular-nums font-medium" style={{ color: "var(--ink)" }} title={c.startingFrom ? "A 'from' price or one that depends on postal code" : "Listed per-meal price for this plan size"}>≈ {formatCents(c.perMealCents)}/meal</span>
                          {c.url && <a href={c.url} target="_blank" rel="noreferrer noopener" title="Open their pricing page" style={{ color: "var(--muted)" }}><ExternalLink size={12} /></a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
        Listed prices as published on each competitor&apos;s site on the date shown; ≈ marks prices read from page text by AI (check the link before acting on them). Portions may differ, so read this as a signal, not a verdict. We never show other PrepFlow kitchens&apos; prices.
      </p>
    </Card>
  );
}
