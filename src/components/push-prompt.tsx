"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * The storefront's "app" moment: offer push reminders (cut-off, delivery day)
 * and, where the browser supports it, an install prompt. Shown once per
 * browser; remembered in localStorage; no server state until they say yes.
 */
export function PushPrompt({ slug, email, businessName, enabled }: { slug: string; email?: string | null; businessName: string; enabled: boolean }) {
  const [state, setState] = useState<"hidden" | "offer" | "done" | "denied">("hidden");
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const key = `pf_push_${slug}`;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "dismissed" || localStorage.getItem(key) === "done";
    } catch {
      /* private mode */
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (!dismissed && Notification.permission !== "denied") {
      const t = setTimeout(() => setState("offer"), 1500);
      return () => clearTimeout(t);
    }
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, [enabled, key]);

  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  // Rendered only after the effect flips state on the client, so this never runs on the server.
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

  const remember = (v: "dismissed" | "done") => {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        remember("dismissed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pub) });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email ?? undefined, subscription: { endpoint: json.endpoint, keys: json.keys } }),
      });
      if (install) {
        await install.prompt().catch(() => {});
      }
      setState("done");
      remember("done");
    } catch {
      setState("denied");
    } finally {
      setBusy(false);
    }
  };

  if (state === "hidden") return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-40 rounded-xl border p-4 shadow-lg" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ background: "color-mix(in srgb, var(--pine) 12%, transparent)", color: "var(--pine)" }}>
          {state === "done" ? <Smartphone size={18} /> : <BellRing size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          {state === "offer" && (
            <>
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>A nudge before your picks lock</div>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-soft)" }}>{businessName} can remind you before the cut-off and on delivery day. No app to install, no email to dig for.</p>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={enable} disabled={busy} className="px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                  {busy ? "One moment…" : "Remind me"}
                </button>
                <button type="button" onClick={() => { setState("hidden"); remember("dismissed"); }} className="px-3 py-2 rounded-lg text-[13px]" style={{ color: "var(--muted)" }}>
                  Not now
                </button>
              </div>
              {isIos && <p className="text-[11.5px] mt-2" style={{ color: "var(--muted)" }}>On iPhone: tap Share, then “Add to Home Screen” first, then open it from there to allow reminders.</p>}
            </>
          )}
          {state === "done" && (
            <>
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Reminders on</div>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {install ? "Add it to your home screen for one-tap ordering." : isIos ? "Tap Share → “Add to Home Screen” for one-tap ordering." : "You can add this page to your home screen for one-tap ordering."}
              </p>
            </>
          )}
          {state === "denied" && (
            <>
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>No problem</div>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-soft)" }}>You&apos;ll still get the email before the cut-off.</p>
            </>
          )}
        </div>
        <button type="button" aria-label="Close" onClick={() => { setState("hidden"); remember(state === "done" ? "done" : "dismissed"); }} className="shrink-0" style={{ color: "var(--muted)" }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
