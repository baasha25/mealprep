"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readConsent } from "@/lib/consent";

/**
 * PostHog product + traffic analytics. Entirely gated on NEXT_PUBLIC_POSTHOG_KEY
 * — with no key set this is inert (no script, no network), so the app runs the
 * same in every environment. Captures page views on route changes (App Router
 * client navigations don't fire a full page load).
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let started = false;

export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!KEY) return;
    if (readConsent() !== "accepted") return; // third-party analytics is opt-in
    let cancelled = false;
    import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;
      if (!started) {
        posthog.init(KEY, {
          api_host: HOST,
          capture_pageview: false, // fired manually on route change (query string included below)
          capture_pageleave: true,
          person_profiles: "identified_only",
        });
        started = true;
      }
      posthog.capture("$pageview", { $current_url: window.location.href });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
