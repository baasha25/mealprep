"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, writeConsent, type Consent } from "@/lib/consent";

/**
 * Cookie-consent banner. Shows once until the visitor chooses. "Accept" enables
 * analytics (PostHog) + attribution; "Decline" blocks non-essential cookies.
 * Accepting reloads so analytics can initialize cleanly from the start.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setShow(true);
  }, []);

  if (!show) return null;

  const choose = (choice: Consent) => {
    writeConsent(choice);
    setShow(false);
    if (choice === "accepted") window.location.reload();
  };

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 border-t"
      style={{ background: "var(--sidebar)", borderColor: "#ffffff1f" }}
    >
      <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center gap-4 flex-wrap">
        <p className="text-[12.5px] leading-snug flex-1 min-w-[240px]" style={{ color: "#f4f2eccc" }}>
          We use cookies to run PrepFlow and, with your consent, to measure traffic and improve the
          product. See our{" "}
          <Link href="/privacy" style={{ color: "#f4f2ec", textDecoration: "underline" }}>Privacy Policy</Link>.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium"
            style={{ background: "#ffffff1a", color: "#f4f2ec" }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium"
            style={{ background: "#f4f2ec", color: "var(--pine)" }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
