"use client";

import { useRouter } from "next/navigation";
import { RANGE_PRESETS, type RangeKey } from "@/lib/date-range";

/**
 * Segmented Today / This Week / This Month / All-time filter. Updates `?range=`
 * on the given basePath so the server page can re-query.
 */
export function RangeFilter({
  basePath,
  current,
  extraParams,
}: {
  basePath: string;
  current: RangeKey;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  const go = (k: RangeKey) => {
    const p = new URLSearchParams(extraParams ?? {});
    if (k !== "all") p.set("range", k);
    else p.delete("range");
    const qs = p.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      {RANGE_PRESETS.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => go(r.key)}
          className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors whitespace-nowrap"
          style={{
            background: current === r.key ? "var(--pine)" : "transparent",
            color: current === r.key ? "#f4f2ec" : "var(--muted)",
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
