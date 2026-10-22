"use client";

import { useEffect, useState } from "react";
import { COUNTRY_COOKIE, CURRENCY_NOTE, currencyForCountry, normalizeCountry, type Currency } from "@/lib/geo";

/**
 * Parity pricing: the same numbers in the visitor's currency. The landing page
 * stays static, so the currency is decided in the browser from the pf_country
 * cookie middleware sets (or a ?country=US override), with a manual toggle.
 * First paint shows CAD; US visitors flip to USD on hydration.
 */
function readCurrency(): Currency {
  try {
    const q = normalizeCountry(new URLSearchParams(window.location.search).get("country"));
    if (q) return currencyForCountry(q);
    const stored = window.localStorage.getItem("pf_currency");
    if (stored === "CAD" || stored === "USD") return stored;
    const m = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([A-Za-z]{2})`));
    return currencyForCountry(m?.[1]?.toUpperCase());
  } catch {
    return "CAD";
  }
}

function useCurrency(): [Currency, (c: Currency) => void] {
  const [currency, setCurrency] = useState<Currency>("CAD");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state after hydration
    setCurrency(readCurrency());
    const onChange = (e: Event) => setCurrency((e as CustomEvent<Currency>).detail);
    window.addEventListener("pf:currency", onChange);
    return () => window.removeEventListener("pf:currency", onChange);
  }, []);
  const set = (c: Currency) => {
    try {
      window.localStorage.setItem("pf_currency", c);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new CustomEvent("pf:currency", { detail: c }));
  };
  return [currency, set];
}

/** "$79" — parity, so only the label changes with currency. */
export function TierPrice({ cents, className, style }: { cents: number; className?: string; style?: React.CSSProperties }) {
  const [currency] = useCurrency();
  return (
    <span className={className} style={style} suppressHydrationWarning>
      ${Math.round(cents / 100)}
      <span className="text-[13px] font-normal align-top ml-1" style={{ opacity: 0.7 }}>{currency}</span>
    </span>
  );
}

/** "Prices in USD." with a CAD / USD toggle. */
export function CurrencyNote() {
  const [currency, set] = useCurrency();
  return (
    <span suppressHydrationWarning>
      {CURRENCY_NOTE[currency]}{" "}
      <span className="inline-flex rounded-md border overflow-hidden align-middle ml-1" style={{ borderColor: "var(--line)" }}>
        {(["CAD", "USD"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => set(c)}
            className="px-2 py-0.5 text-[11.5px] font-medium"
            style={{ background: currency === c ? "var(--pine)" : "transparent", color: currency === c ? "#f4f2ec" : "var(--muted)" }}
            aria-pressed={currency === c}
          >
            {c}
          </button>
        ))}
      </span>
    </span>
  );
}
