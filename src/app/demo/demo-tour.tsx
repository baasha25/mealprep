"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Leaf,
  ArrowRight,
  ArrowLeft,
  Check,
  LayoutDashboard,
  Store,
  TrendingUp,
  Scale,
  Sprout,
  ChefHat,
  Megaphone,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { ATTRIB_COOKIE } from "@/lib/attribution";

type Step = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  blurb: string;
  points: string[];
  img?: string;
  imgAlt?: string;
};

// The guided walkthrough. Screenshots are captured from the live app and live
// in /public/demo. Order = the story a rep tells: what they see → what their
// customers see → the money features (the wedge) → operations → how easy it is
// to switch → the ask.
const STEPS: Step[] = [
  {
    icon: LayoutDashboard,
    kicker: "The owner's view",
    title: "Your whole kitchen on one screen",
    blurb:
      "The moment you log in: real revenue, meals ordered, active subscriptions, and exactly how your week is tracking. No spreadsheets, no guessing.",
    points: [
      "Live revenue, orders, and average order value",
      "Active subscriptions and plan usage at a glance",
      "Everything below rolls up from real orders",
    ],
    img: "/demo/overview.png",
    imgAlt: "PrepFlow owner dashboard showing revenue, meals ordered, and subscriptions",
  },
  {
    icon: Store,
    kicker: "What your customers see",
    title: "A storefront customers actually enjoy",
    blurb:
      "Your own branded ordering page — subscription plans, one-time orders, dietary filters, macros and reviews on every meal. Customers order themselves.",
    points: [
      "Weekly or bi-weekly subscription plans, priced your way",
      "Diet filters, calories, protein, and star reviews per meal",
      "Stop taking orders by text and DM — it runs itself",
    ],
    img: "/demo/storefront.png",
    imgAlt: "Branded customer storefront with subscription plans and meal cards",
  },
  {
    icon: TrendingUp,
    kicker: "Money feature",
    title: "The real margin on every plate",
    blurb:
      "PrepFlow costs each meal from its actual ingredients, then shows margin, contribution, and a true P&L — plus which meals make money and which quietly lose it.",
    points: [
      "Per-meal cost, margin %, and contribution — ranked",
      "Menu engineering: Stars to promote, Dogs to fix or cut",
      "Automatic alerts when ingredient costs rise and squeeze a meal",
    ],
    img: "/demo/profitability.png",
    imgAlt: "Profitability and P&L view with per-meal margins and menu engineering",
  },
  {
    icon: Scale,
    kicker: "Money feature — the full picture",
    title: "The true cost of everything — and what's really left",
    blurb:
      "Food is only half the story. Add your labour and overhead once, and PrepFlow shows your Prime Cost — the number every food business lives or dies by — and your real profit after everything, not just the margin on the food.",
    points: [
      "Prime Cost % (food + labour) with the industry 55% health line built in",
      "A true P&L: revenue minus food, labour, and overhead — what you actually keep",
      "Per-plate real profit, so you see what each meal nets after the whole kitchen",
    ],
    img: "/demo/prime-cost.png",
    imgAlt: "Prime Cost metric and true-profit P&L after labour and overhead",
  },
  {
    icon: Sprout,
    kicker: "Money feature — the big one",
    title: "Stop over-buying, down to the dollar",
    blurb:
      "The shopping list is built from the week's real orders and is trim-aware — so it shows the exact dollars you're buying just to throw away in prep.",
    points: [
      "Buy quantities calculated from what's actually ordered",
      "Biggest waste offenders float to the top of the list",
      "This is the number most kitchens have never seen before",
    ],
    img: "/demo/purchasing.png",
    imgAlt: "Trim-aware purchasing list showing dollars over-bought per ingredient",
  },
  {
    icon: ChefHat,
    kicker: "Kitchen operations",
    title: "The kitchen runs the day off it",
    blurb:
      "The production report tells the team exactly what to make and how much, grouped by meal and station. Labels, packing, and delivery flow from the same orders.",
    points: [
      "Production quantities pulled straight from orders",
      "Grouped by station so the line knows what to cook",
      "One source of truth — no clipboards, no double entry",
    ],
    img: "/demo/kitchen.png",
    imgAlt: "Kitchen production report grouped by meal and station",
  },
  {
    icon: Megaphone,
    kicker: "Grow sales",
    title: "Promotion & marketing, built in",
    blurb:
      "Run coupons and gift cards customers redeem at checkout, and send email campaigns to bring lapsed diners back and reward your regulars — no separate tools.",
    points: [
      "Create coupons and gift cards",
      "Email campaigns to all customers, lapsed, or subscribers",
      "Add a photo and simple formatting to make it look sharp",
    ],
    img: "/demo/marketing.png",
    imgAlt: "Marketing screen with coupons, gift cards, and an email campaign composer",
  },
  {
    icon: Trash2,
    kicker: "Protect your margin",
    title: "Know exactly what you're losing",
    blurb:
      "Log spoilage, dropped deliveries, and remakes. PrepFlow books the real food cost to your P&L, so your profit reflects reality — and you can see where the waste comes from.",
    points: [
      "Log spoilage, dropped orders, or remakes",
      "Books the true food cost to your P&L automatically",
      "See your biggest loss causes at a glance",
    ],
    img: "/demo/waste.png",
    imgAlt: "Waste & Loss screen for logging spoilage, dropped orders, and remakes",
  },
  {
    icon: Upload,
    kicker: "Getting started",
    title: "Switch in an afternoon",
    blurb:
      "Bring your menu, customers, subscriptions, and current inventory over from a spreadsheet. Import, review, done — you're not rebuilding from scratch.",
    points: [
      "CSV import for menu, customers, subscriptions, and stock",
      "Keep your recipes, prices, and active subscribers",
      "Your guide can walk you through this on the call",
    ],
    img: "/demo/import.png",
    imgAlt: "Data import screen for menu, customers, subscriptions, and inventory",
  },
];

export function DemoTour({ rep, repName }: { rep: string | null; repName: string | null }) {
  const [i, setI] = useState(0);
  const last = STEPS.length - 1;
  const onFinal = i === last;

  // Sales attribution: stamp a first-touch cookie so this signup is credited to
  // the demo (and the rep, if the link carried one). Onboarding reads this and
  // writes it onto the new Business; it then shows in /admin. First-party only.
  useEffect(() => {
    try {
      const attrib = {
        source: "demo",
        medium: "sales",
        campaign: rep || "demo",
        referrer: "",
      };
      const value = encodeURIComponent(JSON.stringify(attrib));
      const maxAge = 60 * 60 * 24 * 90;
      document.cookie = `${ATTRIB_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } catch {
      /* attribution is best-effort — never break the demo */
    }
  }, [rep]);

  const go = useCallback(
    (n: number) => setI((cur) => Math.max(0, Math.min(last, n === -1 ? cur : n))),
    [last],
  );
  const next = useCallback(() => setI((c) => Math.min(last, c + 1)), [last]);
  const prev = useCallback(() => setI((c) => Math.max(0, c - 1)), []);

  // Arrow-key navigation so the presenter can drive with the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const signupHref = `/sign-up?utm_source=demo&utm_medium=sales&utm_campaign=${encodeURIComponent(rep || "demo")}`;
  // Hand off from the walkthrough into a real, empty demo kitchen.
  const enterHref = `/demo/${encodeURIComponent(rep || "demo")}/enter`;
  const step = STEPS[i];
  const StepIcon = step.icon;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      {/* Top bar — brand + who's guiding + the step counter */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--paper) 88%, transparent)" }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center w-8 h-8 rounded-md shrink-0" style={{ background: "var(--pine)" }}>
              <Leaf size={17} color="#f4f2ec" />
            </div>
            <span className="disp text-[19px] font-medium truncate" style={{ color: "var(--ink)" }}>
              PrepFlow
            </span>
            <span
              className="hidden sm:inline text-[12px] font-medium px-2 py-0.5 rounded-full ml-1"
              style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)", color: "var(--pine)" }}
            >
              Guided demo
            </span>
          </div>
          <div className="flex items-center gap-3">
            {repName && (
              <span className="hidden sm:block text-[13px]" style={{ color: "var(--muted)" }}>
                with <span style={{ color: "var(--ink)", fontWeight: 500 }}>{repName}</span>
              </span>
            )}
            <span className="text-[12.5px] tabular-nums" style={{ color: "var(--muted)" }}>
              {i + 1} / {STEPS.length}
            </span>
          </div>
        </div>
        {/* Progress dots — presenter and prospect stay in sync ("we're on step 4") */}
        <div className="max-w-6xl mx-auto px-5 pb-3 flex items-center gap-1.5">
          {STEPS.map((_, n) => (
            <button
              key={n}
              onClick={() => go(n)}
              aria-label={`Go to step ${n + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: n === i ? 28 : 16,
                background: n <= i ? "var(--pine)" : "var(--line)",
              }}
            />
          ))}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8 md:py-12">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-8 md:gap-12 items-start">
          {/* Narrative */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="grid place-items-center w-9 h-9 rounded-lg"
                style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)" }}
              >
                <StepIcon size={18} style={{ color: "var(--pine)" }} />
              </div>
              <span
                className="text-[11.5px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--pine)" }}
              >
                {step.kicker}
              </span>
            </div>
            <h1 className="disp text-[30px] md:text-[38px] leading-[1.08] font-medium" style={{ color: "var(--ink)" }}>
              {step.title}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              {step.blurb}
            </p>
            <ul className="mt-5 space-y-2.5">
              {step.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[14px]" style={{ color: "var(--ink)" }}>
                  <span
                    className="grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5"
                    style={{ background: "color-mix(in srgb, var(--pine) 12%, transparent)" }}
                  >
                    <Check size={12} style={{ color: "var(--pine)" }} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-2.5">
              <button
                onClick={prev}
                disabled={i === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-40 transition-opacity"
                style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              {!onFinal ? (
                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[14px] font-medium"
                  style={{ background: "var(--pine)", color: "#f4f2ec" }}
                >
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <Link
                  href={enterHref}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[14px] font-medium"
                  style={{ background: "var(--pine)", color: "#f4f2ec" }}
                >
                  Explore the app yourself <ArrowRight size={16} />
                </Link>
              )}
            </div>
            {/* Jump-ahead link sits right under Back/Next so the hands-on demo is
                always within reach, not only at the very end. */}
            {!onFinal && (
              <Link
                href={enterHref}
                className="inline-flex items-center gap-1 mt-3 text-[13px] font-medium"
                style={{ color: "var(--pine)" }}
              >
                Skip ahead and explore the app yourself <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {/* Screenshot */}
          <div>
            {step.img && (
              <div
                className="rounded-2xl overflow-hidden border shadow-sm"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={step.img} alt={step.imgAlt ?? step.title} className="w-full h-auto block" />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Persistent claim bar — the ask is always one click away */}
      <div
        className="sticky bottom-0 z-40 border-t backdrop-blur"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--paper) 92%, transparent)" }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Sprout size={16} style={{ color: "var(--pine)" }} className="shrink-0" />
            <span className="text-[13.5px] truncate" style={{ color: "var(--ink)" }}>
              Ready to run your kitchen on PrepFlow? <span style={{ color: "var(--muted)" }}>30 days free — no card needed.</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={enterHref}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
              style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
            >
              Explore the app <ArrowRight size={14} />
            </Link>
            <Link
              href={signupHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-medium"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              Start free — claim your kitchen <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
