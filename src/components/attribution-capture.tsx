"use client";

import { useEffect } from "react";
import { ATTRIB_COOKIE, deriveAttribution } from "@/lib/attribution";
import { readConsent } from "@/lib/consent";

/**
 * First-touch attribution: on the first page a visitor lands on, record where
 * they came from (UTM params or referrer) into a 90-day cookie — but only if
 * one isn't already set, and ignoring same-site referrers (internal clicks).
 * Onboarding reads this cookie and stamps it on the new Business.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (readConsent() === "declined") return; // respect an explicit opt-out
      if (document.cookie.split("; ").some((c) => c.startsWith(`${ATTRIB_COOKIE}=`))) return;

      const referrer = document.referrer || "";
      // Treat internal navigation as no referrer.
      let externalReferrer = referrer;
      try {
        if (referrer && new URL(referrer).hostname === window.location.hostname) externalReferrer = "";
      } catch {
        externalReferrer = "";
      }

      const params = new URLSearchParams(window.location.search);
      const attrib = deriveAttribution(params, externalReferrer);

      // Skip writing a pure direct/no-signal hit — leave the cookie unset so a
      // later, more meaningful touch (e.g. a UTM link) can be captured instead.
      if (attrib.source === "direct" && !attrib.campaign) return;

      const value = encodeURIComponent(JSON.stringify(attrib));
      const maxAge = 60 * 60 * 24 * 90;
      document.cookie = `${ATTRIB_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } catch {
      /* attribution is best-effort — never break the page */
    }
  }, []);

  return null;
}
