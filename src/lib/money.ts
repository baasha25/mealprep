// Money + rate formatting. Storage is always integer cents / basis points.
// These helpers convert to/from the human-facing dollar & percent forms.

/** 1250 -> "$12.50" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 1250 -> "$13" (rounded, no decimals) — for big KPI numbers */
export function formatCents0(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** "12.50" | 12.5 -> 1250 cents (throws on non-finite) */
export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) throw new Error(`Invalid dollar amount: ${dollars}`);
  return Math.round(n * 100);
}

/** 1250 cents -> 12.5 (for prefilling form inputs) */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** 800 bps -> 8 (percent) */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** 8 (percent) -> 800 bps */
export function percentToBps(percent: number | string): number {
  const n = typeof percent === "string" ? Number(percent) : percent;
  if (!Number.isFinite(n)) throw new Error(`Invalid percent: ${percent}`);
  return Math.round(n * 100);
}
