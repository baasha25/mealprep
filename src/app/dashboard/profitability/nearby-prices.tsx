"use client";

import { useState, useTransition } from "react";
import { MapPin, RefreshCw, Trash2, Check, X, ExternalLink, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { addCompetitor, refreshCompetitor, removeCompetitor, setMatchStatus } from "./competitor-actions";
import type { NearbyCompetitor, NearbyRow } from "@/lib/competitors-data";

type Suggestion = { name: string; domain: string; city: string; region: string; platform: string };

export function NearbyPrices({ competitors, rows, suggestedCount, isPro, suggestions }: { competitors: NearbyCompetitor[]; rows: NearbyRow[]; suggestedCount: number; isPro: boolean; suggestions: Suggestion[] }) {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [region, setRegion] = useState("GTA");
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
        We read competitors' public menus (names, prices, links; nothing else) once a week and suggest matches for your meals. Confirm the ones that are really the same dish; only confirmed matches count.
      </p>

      {/* Watched competitors */}
      <div className="flex flex-wrap gap-2 mb-3">
        {competitors.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12px]" style={{ borderColor: c.status === "ok" ? "var(--line)" : "var(--clay)", background: "var(--paper)" }} title={c.lastError ?? ""}>
            <span className="font-medium" style={{ color: "var(--ink)" }}>{c.name}</span>
            <span style={{ color: "var(--muted)" }}>{c.status === "ok" ? `${c.itemCount} items · ${c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}` : c.status === "unsupported" ? "can't read yet" : "error"}</span>
            <button type="button" onClick={() => run(() => refreshCompetitor(c.id))} disabled={pending} title="Refresh" style={{ color: "var(--muted)" }}><RefreshCw size={12} /></button>
            <button type="button" onClick={() => run(() => removeCompetitor(c.id))} disabled={pending} title="Stop watching" style={{ color: "var(--muted)" }}><Trash2 size={12} /></button>
          </div>
        ))}
        {competitors.length === 0 && <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>No competitors watched yet.</span>}
      </div>

      {/* Add by URL + nearby suggestions */}
      <form className="flex gap-2 mb-2" onSubmit={(e) => { e.preventDefault(); if (!url.trim()) return; run(async () => { const r = await addCompetitor({ url }); if (r.ok) setUrl(""); return r; }); }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Competitor website, e.g. powerkitchen.ca" className="flex-1 px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} />
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
      {msg && <p className="text-[12.5px] mb-3" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>{msg.text}</p>}

      {/* Per-meal comparison */}
      {competitors.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <div className="hidden sm:grid grid-cols-[1.5fr_80px_90px_150px_1fr_28px] gap-3 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", background: "var(--paper)" }}>
            <span>Your meal</span><span className="text-right">You</span><span className="text-right">Matches</span><span className="text-right">Nearby range · median</span><span>Position</span><span />
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
                        <span className="tabular-nums font-medium" style={{ color: "var(--ink)" }}>{formatCents(m.priceCents)}</span>
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
      <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
        Listed prices as published on each competitor's site on the date shown; portions may differ, so read this as a signal, not a verdict. We never show other PrepFlow kitchens' prices.
      </p>
    </Card>
  );
}
