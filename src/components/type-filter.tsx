import Link from "next/link";
import { ORDER_TYPE_PRESETS, type OrderTypeKey } from "@/lib/order-type-filter";

/**
 * All orders / Storefront / Catering — a small segmented filter that keeps the
 * current `?range=` so the two filters compose. Shown only when the kitchen
 * has catering on (otherwise it is noise).
 */
export function TypeFilter({ basePath, current, range }: { basePath: string; current: OrderTypeKey; range?: string }) {
  const href = (k: OrderTypeKey) => {
    const p = new URLSearchParams();
    if (range && range !== "all") p.set("range", range);
    if (k !== "all") p.set("type", k);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      {ORDER_TYPE_PRESETS.map((t) => (
        <Link
          key={t.key}
          href={href(t.key)}
          className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors whitespace-nowrap"
          style={{ background: current === t.key ? "var(--pine)" : "transparent", color: current === t.key ? "#f4f2ec" : "var(--muted)" }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
