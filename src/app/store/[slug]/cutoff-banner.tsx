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
      <span className="tabular-nums font-bold text-[22px] sm:text-[26px]">{val}</span>
      <span className="text-[9.5px] uppercase tracking-wide opacity-75 mt-1">{label}</span>
    </span>
  );
  const sep = <span className="opacity-40 font-bold text-[20px] sm:text-[24px] -mt-2.5">:</span>;

  return (
    <div
      className="w-full text-white"
      style={{ background: brandColor }}
      role="status"
      aria-live="off"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-x-4 gap-y-1.5 flex-wrap text-center">
        <Clock size={19} className="opacity-90 shrink-0" />
        {closed ? (
          <span className="text-[15px] font-medium">
            Ordering for this delivery has closed — check back soon for the next window.
          </span>
        ) : (
          <>
            <span className="text-[14px] sm:text-[15.5px] font-medium">
              Order by <strong>{cutoffLabel}</strong>
              {deliveryLabel ? <> — arrives <strong>{deliveryLabel}</strong></> : null}. Closes in
            </span>
            <span className="inline-flex items-center gap-2">
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
                <span className="tabular-nums font-bold text-[22px] sm:text-[26px] opacity-80">—:—:—</span>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
