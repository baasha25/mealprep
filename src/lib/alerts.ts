// Alert hierarchy — one vocabulary for every "something needs you" surface
// (dashboard panel, P&L focus box, sidebar dot, admin badges).
//
//   urgent — money is leaking or a customer is about to be lost. Bold, a solid
//            clay bar, an action verb first. The ONLY level that gets bold.
//   watch  — trending the wrong way, not yet costing money. Amber dot.
//   info   — things to know (reviews to approve). Muted, no colour.
//
// Palette stays PrepFlow's: clay, not fire-engine red. The difference is weight,
// position and a verb, which is how a dashboard shouts without getting ugly.

export type AlertLevel = "urgent" | "watch" | "info";

export const LEVEL_ORDER: Record<AlertLevel, number> = { urgent: 0, watch: 1, info: 2 };

export const ALERT_STYLE: Record<
  AlertLevel,
  { bg: string; border: string; dot: string; bar: string | null; weight: number; ink: string }
> = {
  urgent: {
    bg: "color-mix(in srgb, var(--clay) 9%, transparent)",
    border: "color-mix(in srgb, var(--clay) 35%, transparent)",
    dot: "var(--clay)",
    bar: "var(--clay)",
    weight: 600,
    ink: "var(--ink)",
  },
  watch: {
    bg: "color-mix(in srgb, #c9a227 10%, transparent)",
    border: "color-mix(in srgb, #c9a227 30%, transparent)",
    dot: "#c9a227",
    bar: null,
    weight: 450,
    ink: "var(--ink)",
  },
  info: {
    bg: "var(--surface)",
    border: "var(--line)",
    dot: "var(--muted)",
    bar: null,
    weight: 450,
    ink: "var(--ink-soft)",
  },
};

export type Alert = { key: string; level: AlertLevel; text: string; href: string };

/** Urgent first, then watch, then info; stable within a level. */
export function sortAlerts<T extends { level: AlertLevel }>(alerts: T[]): T[] {
  return alerts.slice().sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** "1 urgent · 2 to watch · 1 to review" for a card title; "All clear" when empty. */
export function alertSummary(alerts: { level: AlertLevel }[]): string {
  if (alerts.length === 0) return "All clear";
  const n = (l: AlertLevel) => alerts.filter((a) => a.level === l).length;
  const parts: string[] = [];
  if (n("urgent")) parts.push(`${n("urgent")} urgent`);
  if (n("watch")) parts.push(`${n("watch")} to watch`);
  if (n("info")) parts.push(`${n("info")} to review`);
  return parts.join(" · ");
}

export function urgentCount(alerts: { level: AlertLevel }[]): number {
  return alerts.filter((a) => a.level === "urgent").length;
}
