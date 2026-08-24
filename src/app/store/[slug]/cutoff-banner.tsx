"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function remaining(ms: number) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Storefront urgency bar: a live countdown to the weekly order cut-off, plus the
 * delivery date it unlocks. The target instant is computed server-side (in the
 * kitchen's timezone) and passed as an ISO string; this just ticks toward it.
 */
export function CutoffBanner({
  cutoffISO,
  cutoffLabel,
  deliveryLabel,
  brandColor,
}: {
  cutoffISO: string;
  cutoffLabel: string;
  deliveryLabel: string | null;
  brandColor: string;
}) {
  const target = new Date(cutoffISO).getTime();
  // null until mounted, so server and first client render match (no hydration mismatch).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now == null ? null : remaining(target - now);
  const closed = now != null && left == null;

  const unit = (val: string, label: string) => (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="tabular-nums font-bold text-[15px] sm:text-[16px]">{val}</span>
      <span className="text-[8.5px] uppercase tracking-wide opacity-75 mt-0.5">{label}</span>
    </span>
  );
  const sep = <span className="opacity-40 font-bold text-[14px] -mt-2">:</span>;

  return (
    <div
      className="w-full text-white"
      style={{ background: brandColor }}
      role="status"
      aria-live="off"
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
        <Clock size={15} className="opacity-90 shrink-0" />
        {closed ? (
          <span className="text-[13px] font-medium">
            Ordering for this delivery has closed — check back soon for the next window.
          </span>
        ) : (
          <>
            <span className="text-[12.5px] sm:text-[13px] font-medium">
              Order by <strong>{cutoffLabel}</strong>
              {deliveryLabel ? <> — arrives <strong>{deliveryLabel}</strong></> : null}. Closes in
            </span>
            <span className="inline-flex items-center gap-1.5">
              {left ? (
                <>
                  {left.d > 0 && (
                    <>
                      {unit(String(left.d), "days")}
                      {sep}
                    </>
                  )}
                  {unit(pad(left.h), "hrs")}
                  {sep}
                  {unit(pad(left.m), "min")}
                  {sep}
                  {unit(pad(left.s), "sec")}
                </>
              ) : (
                // pre-mount placeholder (keeps layout stable, no ticking yet)
                <span className="tabular-nums font-bold text-[15px] opacity-80">—:—:—</span>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
