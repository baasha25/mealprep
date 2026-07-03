import { Monitor, Flame, Soup, Salad, Boxes, Play, RotateCcw, Check } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { STATIONS } from "@/lib/stations";
import { AutoRefresh } from "./auto-refresh";
import { startProductionRun, advanceTicket, clearTickets } from "./actions";

const STATION_ICON: Record<string, typeof Flame> = {
  Grill: Flame,
  Sauté: Soup,
  "Cold Station": Salad,
  Prep: Boxes,
};

// Per-status visual language for a glanceable line screen.
const STATUS = {
  todo: { label: "To do", card: "var(--surface)", border: "var(--line)", accent: "var(--muted)" },
  cooking: { label: "Cooking", card: "color-mix(in srgb, var(--clay) 8%, var(--surface))", border: "var(--clay)", accent: "var(--clay)" },
  done: { label: "Done", card: "color-mix(in srgb, var(--pine) 8%, var(--surface))", border: "var(--pine)", accent: "var(--pine)" },
} as const;

export default async function KdsPage() {
  const { business } = await requireBusiness();
  const tickets = await db.productionTicket.findMany({
    where: { businessId: business.id },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const totalMeals = tickets.reduce((s, t) => s + t.qty, 0);
  const doneMeals = tickets.filter((t) => t.status === "done").reduce((s, t) => s + t.qty, 0);
  const pct = totalMeals ? Math.round((doneMeals / totalMeals) * 100) : 0;

  return (
    <Page>
      <AutoRefresh />
      <Head
        kicker="Kitchen OS"
        title="Kitchen Display"
        sub="Live production tickets for the line — tap a ticket to move it To do → Cooking → Done."
        right={
          <div className="flex items-center gap-2">
            {tickets.length > 0 && (
              <form action={clearTickets}>
                <button type="submit" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
                  <RotateCcw size={14} /> Clear
                </button>
              </form>
            )}
            <form action={startProductionRun}>
              <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                <Play size={15} /> {tickets.length > 0 ? "Restart run" : "Start production run"}
              </button>
            </form>
          </div>
        }
      />

      {tickets.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <Monitor size={26} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>No active production run.</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
            Start a run to turn the paid/in-production queue into line tickets.
          </p>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="rounded-xl border p-4 mb-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                {doneMeals} / {totalMeals} meals done
              </span>
              <span className="text-[13px] font-semibold" style={{ color: "var(--pine)" }}>{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full" style={{ background: "var(--sand)" }}>
              <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--pine)" }} />
            </div>
          </div>

          {/* Station columns */}
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STATIONS.map((station) => {
              const stationTickets = tickets.filter((t) => t.station === station);
              if (stationTickets.length === 0) return null;
              const Icon = STATION_ICON[station] ?? Boxes;
              const remaining = stationTickets.filter((t) => t.status !== "done").reduce((s, t) => s + t.qty, 0);
              return (
                <div key={station}>
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--pine)" }}><Icon size={16} /></span>
                      <h3 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{station}</h3>
                    </div>
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}>{remaining} left</span>
                  </div>
                  <div className="space-y-2.5">
                    {stationTickets.map((t) => {
                      const s = STATUS[t.status];
                      const done = t.status === "done";
                      return (
                        <form key={t.id} action={advanceTicket}>
                          <input type="hidden" name="ticketId" value={t.id} />
                          <button
                            type="submit"
                            className="w-full text-left rounded-xl border p-3.5 transition-transform active:scale-[0.98]"
                            style={{ background: s.card, borderColor: s.border, borderWidth: t.status === "todo" ? 1 : 1.5 }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="disp text-[26px] font-medium leading-none" style={{ color: done ? "var(--muted)" : "var(--ink)" }}>{t.qty}</span>
                              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.accent }}>
                                {done && <Check size={12} />} {s.label}
                              </span>
                            </div>
                            <div className="mt-1.5 text-[13.5px] font-medium leading-snug" style={{ color: done ? "var(--muted)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
                              {t.mealName}
                            </div>
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
