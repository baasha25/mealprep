import type { BadgeTone } from "@/lib/admin-metrics";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  pine: { bg: "color-mix(in srgb, var(--pine) 14%, transparent)", fg: "var(--pine)" },
  clay: { bg: "color-mix(in srgb, var(--clay) 14%, transparent)", fg: "var(--clay)" },
  amber: { bg: "color-mix(in srgb, #c9a227 16%, transparent)", fg: "#8a6d1f" },
  sand: { bg: "var(--sand)", fg: "var(--ink-soft)" },
  muted: { bg: "color-mix(in srgb, var(--muted) 12%, transparent)", fg: "var(--muted)" },
};

/** Small status pill used across the operator panel (server-safe). */
export function Badge({ tone, children, title, urgent = false }: { tone: BadgeTone; children: React.ReactNode; title?: string; urgent?: boolean }) {
  const t = urgent ? { bg: "var(--clay)", fg: "#f4f2ec" } : TONES[tone];
  return (
    <span
      title={title}
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap ${urgent ? "font-bold" : "font-semibold"}`}
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}
