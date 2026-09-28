import type { BadgeTone } from "@/lib/admin-metrics";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  pine: { bg: "color-mix(in srgb, var(--pine) 14%, transparent)", fg: "var(--pine)" },
  clay: { bg: "color-mix(in srgb, var(--clay) 14%, transparent)", fg: "var(--clay)" },
  sand: { bg: "var(--sand)", fg: "var(--ink-soft)" },
  muted: { bg: "color-mix(in srgb, var(--muted) 12%, transparent)", fg: "var(--muted)" },
};

/** Small status pill used across the operator panel (server-safe). */
export function Badge({ tone, children, title }: { tone: BadgeTone; children: React.ReactNode; title?: string }) {
  const t = TONES[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}
