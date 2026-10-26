import Link from "next/link";

/** Delivery-day filter chips for kitchen pages: "All days" + one per upcoming day (server component, link-based). */
export function DayChips({ basePath, days, active, noun }: { basePath: string; days: { key: string; date: Date | null; items: number }[]; active: string; noun: string }) {
  if (days.length < 2) return null;
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const chip = (href: string, label: string, on: boolean) => (
    <Link key={href} href={href} className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ background: on ? "var(--ink)" : "var(--surface)", color: on ? "#f4f2ec" : "var(--ink-soft)", borderColor: on ? "var(--ink)" : "var(--line)" }}>
      {label}
    </Link>
  );
  return (
    <div className="no-print flex gap-1.5 mb-4 flex-wrap items-center">
      <span className="text-[12px] mr-1" style={{ color: "var(--muted)" }}>Delivery day:</span>
      {chip(basePath, "All days", !active)}
      {days.map((d) => chip(`${basePath}?day=${d.key || "none"}`, `${d.date ? fmt.format(d.date) : "No date"} · ${d.items} ${noun}`, active === (d.key || "none")))}
    </div>
  );
}
