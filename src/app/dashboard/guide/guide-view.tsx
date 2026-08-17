"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Search, MapPin, ListChecks, Hash, Lightbulb, X, ChevronRight, BookOpen } from "lucide-react";
import { GUIDE, GUIDE_INTRO, type GuideSection } from "@/lib/guide-content";

// Flattened, searchable index of every section (with its area label).
const ALL: (GuideSection & { area: string })[] = GUIDE.flatMap((a) =>
  a.sections.map((s) => ({ ...s, area: a.label })),
);
const haystack = (s: GuideSection & { area: string }) =>
  [
    s.title,
    s.where,
    s.does,
    ...(s.use ?? []),
    ...(s.numbers ?? []).flat(),
    ...(s.tips ?? []),
  ]
    .join(" ")
    .toLowerCase();
const INDEX = new Map(ALL.map((s) => [s.id, haystack(s)]));

export function GuideView() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string>(ALL[0]?.id ?? "");
  const query = q.trim().toLowerCase();

  const matchIds = useMemo(() => {
    if (!query) return null; // null = show everything
    return new Set(ALL.filter((s) => (INDEX.get(s.id) ?? "").includes(query)).map((s) => s.id));
  }, [query]);

  // Scroll-spy: highlight the TOC entry for the section currently on screen.
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (query) return; // spy only in browse mode
    observer.current?.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    for (const s of ALL) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    observer.current = obs;
    return () => obs.disconnect();
  }, [query]);

  const totalMatches = matchIds ? matchIds.size : ALL.length;

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
      {/* ---- Sticky table of contents ---- */}
      <aside className="hidden lg:block">
        <div className="sticky top-6">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the guide…"
              className="w-full pl-8 pr-7 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Clear search">
                <X size={14} style={{ color: "var(--muted)" }} />
              </button>
            )}
          </div>
          <nav className="flex flex-col gap-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
            {GUIDE.map((area) => {
              const items = area.sections.filter((s) => !matchIds || matchIds.has(s.id));
              if (items.length === 0) return null;
              return (
                <div key={area.label}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.13em] px-2 mb-1" style={{ color: "var(--muted)" }}>
                    {area.label}
                  </div>
                  {items.map((s) => {
                    const on = active === s.id && !query;
                    return (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        onClick={() => setActive(s.id)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12.5px] transition-colors"
                        style={{ background: on ? "var(--paper-2, #efe9dd)" : "transparent", color: on ? "var(--pine)" : "var(--ink-soft)", fontWeight: on ? 600 : 450 }}
                      >
                        <span className="tabular-nums opacity-50 w-4 text-right">{s.n}</span>
                        <span className="truncate">{s.title}</span>
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* ---- Content ---- */}
      <div className="min-w-0">
        {/* Mobile search */}
        <div className="lg:hidden relative mb-5">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the guide…"
            className="w-full pl-8 pr-7 py-2.5 rounded-lg text-[14px] outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Clear search">
              <X size={16} style={{ color: "var(--muted)" }} />
            </button>
          )}
        </div>

        {query ? (
          <p className="text-[13px] mb-5" style={{ color: "var(--muted)" }}>
            {totalMatches === 0 ? "No matches — try another word." : `${totalMatches} ${totalMatches === 1 ? "topic" : "topics"} matching "${q}".`}
          </p>
        ) : (
          <IntroBlock />
        )}

        <div className="flex flex-col gap-4">
          {ALL.filter((s) => !matchIds || matchIds.has(s.id)).map((s) => (
            <SectionCard key={s.id} s={s} highlight={query} />
          ))}
        </div>

        {!query && (
          <div className="mt-8 rounded-xl border px-5 py-4 flex items-start gap-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <BookOpen size={17} style={{ color: "var(--pine)", marginTop: 1 }} />
            <div className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
              <span className="font-semibold" style={{ color: "var(--ink)" }}>The two habits that make everything work: </span>
              (1) enter your recipes so the money numbers are accurate, and (2) take every sale through PrepFlow so the numbers are complete. Do those two things and PrepFlow tells you, in real dollars, exactly how your kitchen is doing.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IntroBlock() {
  return (
    <div className="mb-6">
      <div className="rounded-xl px-5 py-4 mb-3" style={{ background: "var(--sand, #efe7d8)", borderLeft: "3px solid var(--pine)" }}>
        <div className="text-[14px] font-semibold mb-1.5" style={{ color: "var(--pine)" }}>{GUIDE_INTRO.bigIdea.title}</div>
        {GUIDE_INTRO.bigIdea.points.map((p, i) => (
          <p key={i} className="text-[13px] leading-relaxed mb-1.5 last:mb-0" style={{ color: "var(--ink-soft)" }}>{p}</p>
        ))}
      </div>
      <details className="rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <summary className="cursor-pointer list-none px-5 py-3 flex items-center gap-2 text-[13px] font-medium select-none" style={{ color: "var(--ink)" }}>
          <ChevronRight size={15} style={{ color: "var(--muted)" }} />
          A few words you'll see everywhere
        </summary>
        <div className="px-5 pb-4">
          <dl className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            {GUIDE_INTRO.glossary.map(([term, def], i) => (
              <div key={term} className="grid sm:grid-cols-[180px_1fr]" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                <dt className="px-3 py-2 text-[12.5px] font-semibold" style={{ color: "var(--ink)", background: "var(--paper-2, #efe9dd)" }}>{term}</dt>
                <dd className="px-3 py-2 text-[12.5px]" style={{ color: "var(--ink-soft)" }}>{def}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </div>
  );
}

function SectionCard({ s, highlight }: { s: GuideSection & { area: string }; highlight: string }) {
  return (
    <section id={s.id} className="scroll-mt-24 rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="px-5 sm:px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="grid place-items-center w-6 h-6 rounded-md text-[12px] font-semibold tabular-nums" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{s.n}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: "var(--paper-2, #efe9dd)", color: "var(--clay)" }}>
            <MapPin size={11} /> {s.where}
          </span>
        </div>
        <h2 className="disp text-[20px] font-semibold mb-2" style={{ color: "var(--ink)" }}>{s.title}</h2>
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          <span className="font-semibold" style={{ color: "var(--pine)" }}>What it does. </span>
          {mark(s.does, highlight)}
        </p>

        {s.use && s.use.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
              <ListChecks size={14} /> How you use it
            </div>
            <ol className="flex flex-col gap-1.5">
              {s.use.map((u, i) => (
                <li key={i} className="flex gap-2.5 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                  <span className="grid place-items-center shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold" style={{ background: "var(--paper-2, #efe9dd)", color: "var(--pine)" }}>{i + 1}</span>
                  <span className="pt-0.5">{mark(u, highlight)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {s.img && (
          <a href={`/guide/${s.img}`} target="_blank" rel="noreferrer" className="block mt-4 rounded-lg overflow-hidden border" style={{ borderColor: "var(--line)" }} title="Open full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/guide/${s.img}`} alt={`${s.title} screen`} loading="lazy" className="w-full h-auto block" />
          </a>
        )}
      </div>

      {s.numbers && s.numbers.length > 0 && (
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            <Hash size={14} /> What every number means
          </div>
          <dl className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            {s.numbers.map(([term, def], i) => (
              <div key={term} className="grid sm:grid-cols-[210px_1fr]" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                <dt className="px-3 py-2 text-[12.5px] font-semibold" style={{ color: "var(--ink)", background: "var(--paper-2, #efe9dd)" }}>{mark(term, highlight)}</dt>
                <dd className="px-3 py-2 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{mark(def, highlight)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {s.tips && s.tips.length > 0 && (
        <div className="px-5 sm:px-6 pb-5">
          <div className="rounded-lg px-4 py-3 flex gap-2.5" style={{ background: "var(--sand, #efe7d8)" }}>
            <Lightbulb size={15} style={{ color: "var(--pine)", marginTop: 1, flexShrink: 0 }} />
            <div className="flex flex-col gap-1.5">
              {s.tips.map((t, i) => (
                <p key={i} className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink)" }}>{mark(t, highlight)}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Highlight the search term inside a string.
function mark(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#f6e6b8", color: "inherit", borderRadius: 2 }}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
