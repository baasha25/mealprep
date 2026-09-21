"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

// Crisp website ID is a PUBLIC client-side identifier (it ships in the page for
// every visitor by design — not a secret). Overridable per-deploy via env.
const CRISP_WEBSITE_ID =
  process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID || "ca1b4eb9-8d2a-4d39-a5d6-3af78fac2733";

// Diner-facing surfaces: a PrepFlow support chat here would confuse a kitchen's
// own customers, so Crisp never loads on the public storefront or diner account.
const HIDE_ON = ["/store", "/account"];

/**
 * Loads the Crisp live-chat widget on PrepFlow's own marketing + owner-facing
 * pages only. Lazy: the Crisp script is never injected on excluded routes, so
 * diners on a kitchen's storefront never pull it in.
 */
export function CrispChat() {
  const pathname = usePathname();
  const hidden =
    !CRISP_WEBSITE_ID || HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (hidden) {
      // If Crisp was already loaded on a prior (allowed) route, just hide it.
      window.$crisp?.push(["do", "chat:hide"]);
      return;
    }

    if (window.$crisp) {
      window.$crisp.push(["do", "chat:show"]);
      return;
    }

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
    const s = document.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    document.head.appendChild(s);
  }, [hidden]);

  return null;
}
