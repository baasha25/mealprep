// Build-your-own meals — pure helpers shared by the storefront (client), the
// order actions (server), production, labels, and purchasing. No DB here.

export type OptionLike = {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
  active?: boolean;
  allergens?: string[];
};
export type OptionGroupLike = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: OptionLike[];
};

/** One chosen option, as frozen onto an order/selection line. */
export type OptionPick = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
};

export type ResolveResult =
  | { ok: true; picks: OptionPick[]; priceDeltaCents: number; optionsKey: string }
  | { ok: false; message: string };

/** Stable key for a configuration: sorted option ids joined by "+" ("" = none). */
export function optionsKeyOf(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join("+");
}

/** "Chicken Bowl" + [Quinoa, Tofu] → "Chicken Bowl (Quinoa · Tofu)". */
export function nameWithOptions(base: string, picks: readonly { optionName: string }[]): string {
  if (!picks.length) return base;
  return `${base} (${picks.map((p) => p.optionName).join(" · ")})`;
}

/** Sum of price deltas. */
export function priceDeltaOf(picks: readonly { priceDeltaCents: number }[]): number {
  return picks.reduce((s, p) => s + p.priceDeltaCents, 0);
}

/**
 * Validate a customer's option choices against a meal's groups and fill in
 * defaults where nothing was chosen. Rules per group: at least `minSelect`, at
 * most `maxSelect`; unknown/inactive ids are rejected (never price a stale pick).
 * With no request at all, every required group gets its default (or first
 * active) option — this is what POS and subscriptions rely on.
 */
export function resolveSelections(groups: readonly OptionGroupLike[], requested?: readonly string[]): ResolveResult {
  const want = new Set(requested ?? []);
  const known = new Set<string>();
  const picks: OptionPick[] = [];

  for (const g of groups) {
    const active = g.options.filter((o) => o.active !== false);
    for (const o of active) known.add(o.id);
    let chosen = active.filter((o) => want.has(o.id));
    if (chosen.length === 0 && g.minSelect >= 1) {
      const defaults = active.filter((o) => o.isDefault).slice(0, Math.max(1, g.maxSelect));
      chosen = defaults.length ? defaults : active.slice(0, 1);
    }
    if (chosen.length < g.minSelect) {
      return { ok: false, message: `Choose ${g.minSelect === 1 ? "an option" : `at least ${g.minSelect}`} for ${g.name}.` };
    }
    if (chosen.length > g.maxSelect) {
      return { ok: false, message: `Choose at most ${g.maxSelect} for ${g.name}.` };
    }
    for (const o of chosen) {
      picks.push({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, priceDeltaCents: o.priceDeltaCents });
    }
  }

  for (const id of want) {
    if (!known.has(id)) return { ok: false, message: "An option you picked is no longer available — please re-select." };
  }

  return { ok: true, picks, priceDeltaCents: priceDeltaOf(picks), optionsKey: optionsKeyOf(picks.map((p) => p.optionId)) };
}

/** Safe parse of a stored optionsSnapshot Json back into picks (tolerates junk). */
export function picksFromSnapshot(snap: unknown): OptionPick[] {
  if (!Array.isArray(snap)) return [];
  const out: OptionPick[] = [];
  for (const x of snap) {
    if (x && typeof x === "object" && typeof (x as OptionPick).optionId === "string") {
      const p = x as Partial<OptionPick>;
      out.push({
        groupId: String(p.groupId ?? ""),
        groupName: String(p.groupName ?? ""),
        optionId: String(p.optionId),
        optionName: String(p.optionName ?? ""),
        priceDeltaCents: Number(p.priceDeltaCents ?? 0) || 0,
      });
    }
  }
  return out;
}

/** The default configuration's option ids (what profitability costs a meal at). */
export function defaultOptionIds(groups: readonly OptionGroupLike[]): string[] {
  const r = resolveSelections(groups, []);
  return r.ok ? r.picks.map((p) => p.optionId) : [];
}
