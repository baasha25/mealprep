import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  TrendingDown,
  Upload,
  Star,
  Store,
  ChefHat,
  Wallet,
  BarChart3,
  Truck,
  Check,
  Leaf,
  Sparkles,
  Boxes,
  Monitor,
  Mail,
  CreditCard,
} from "lucide-react";
import { SiteNav } from "@/components/marketing/site-nav";
import { Faq } from "@/components/marketing/faq";

export const dynamic = "force-dynamic";

export default async function Home() {
  // A signed-in owner landing on the marketing root goes straight to work.
  if (process.env.CLERK_SECRET_KEY) {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return (
    <div style={{ background: "var(--paper)" }}>
      <SiteNav />
      <Hero />
      <Logos />
      <HowItWorks />
      <Features />
      <Platform />
      <Pricing />
      <Testimonial />
      <section id="faq" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <SectionKicker>FAQ</SectionKicker>
        <SectionTitle>Questions, answered</SectionTitle>
        <div className="mt-12">
          <Faq />
        </div>
      </section>
      <CtaBand />
      <Footer />
    </div>
  );
}

/* ------------------------------ primitives ------------------------------ */

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-3 text-center" style={{ color: "var(--clay)" }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="disp text-[32px] md:text-[40px] leading-[1.1] font-medium text-center max-w-2xl mx-auto" style={{ color: "var(--ink)" }}>
      {children}
    </h2>
  );
}

/* --------------------------------- hero --------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(1100px 500px at 70% -10%, color-mix(in srgb, var(--pine) 12%, transparent), transparent 60%)" }}
      />
      <div className="max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-16 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-[12.5px] font-medium" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
            <Sparkles size={14} style={{ color: "var(--clay)" }} /> One platform for the whole kitchen
          </div>
          <h1 className="disp text-[42px] md:text-[58px] leading-[1.03] font-medium" style={{ color: "var(--ink)" }}>
            Run your meal-prep business in one place.
          </h1>
          <p className="mt-5 text-[16px] md:text-[17px] leading-relaxed max-w-xl" style={{ color: "var(--ink-soft)" }}>
            Storefront, subscriptions, payments, kitchen ops, delivery, and marketing —
            without the duct tape. Built to protect your margins and make switching painless.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
              Start free <ArrowRight size={17} />
            </Link>
            <a href="https://calendly.com/gobie-thina6/30min" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}>
              Book a demo
            </a>
          </div>
          <div className="mt-6 flex items-center gap-5 text-[12.5px]" style={{ color: "var(--muted)" }}>
            <span className="flex items-center gap-1.5"><Check size={14} style={{ color: "var(--pine)" }} /> No card required</span>
            <span className="flex items-center gap-1.5"><Check size={14} style={{ color: "var(--pine)" }} /> Migrate in an afternoon</span>
          </div>
        </div>
        <HeroMock />
      </div>
    </section>
  );
}

// Stylized product mock — echoes the real margin/waste dashboard (the flagship feature).
function HeroMock() {
  return (
    <div className="relative">
      <div className="rounded-2xl border p-5 shadow-xl" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 30px 60px -20px rgba(31,30,26,.25)" }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e3b7a8" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e8dcb0" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#bcd0bd" }} />
          <span className="ml-2 text-[12px] font-medium" style={{ color: "var(--muted)" }}>Purchasing & waste</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[["To purchase", "$154.28", "var(--ink)"], ["Over-bought", "$18.96", "var(--clay)"], ["Waste share", "12.3%", "var(--ink)"]].map(([l, v, c]) => (
            <div key={l} className="rounded-lg p-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="text-[10px]" style={{ color: "var(--muted)" }}>{l}</div>
              <div className="disp text-[18px] font-medium mt-1" style={{ color: c as string }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {[["Sirloin steak", 0.92, "$5.81"], ["Asparagus", 0.64, "$3.42"], ["Shrimp", 0.48, "$2.55"], ["Broccoli", 0.33, "$1.71"]].map(([name, w, amt]) => (
            <div key={name as string}>
              <div className="flex justify-between text-[11.5px] mb-1">
                <span style={{ color: "var(--ink)" }}>{name}</span>
                <span style={{ color: "var(--clay)" }}>{amt}</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "var(--sand)" }}>
                <div className="h-2 rounded-full" style={{ width: `${(w as number) * 100}%`, background: "var(--clay)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-5 rounded-xl border p-3.5 shadow-lg hidden sm:block" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 16px 30px -12px rgba(31,30,26,.22)" }}>
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-lg" style={{ background: "color-mix(in srgb, var(--pine) 12%, transparent)" }}>
            <TrendingDown size={17} style={{ color: "var(--pine)" }} />
          </div>
          <div>
            <div className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>$18.96 to cut</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>this production run</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Logos() {
  return (
    <section className="border-y" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>Trusted by independent kitchens like</span>
        {["Greenleaf Kitchen", "FuelHouse", "Cedar & Sage", "Prep Collective", "Nourish Co."].map((n) => (
          <span key={n} className="disp text-[16px] font-medium" style={{ color: "var(--ink-soft)", opacity: 0.75 }}>{n}</span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ how it works ---------------------------- */

function HowItWorks() {
  const steps = [
    ["Import your kitchen", "Bring your menu, customers, and active subscriptions across from a spreadsheet — live in an afternoon.", Upload],
    ["Sell & subscribe", "Open your branded storefront. Diners order, subscribe, and manage their own plans.", Store],
    ["Run the line", "Production, trim-aware purchasing, labels, packing, and routes — the whole kitchen on one screen.", ChefHat],
  ] as const;
  return (
    <section id="how" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <SectionKicker>How it works</SectionKicker>
      <SectionTitle>Live in three steps</SectionTitle>
      <div className="mt-14 grid md:grid-cols-3 gap-6">
        {steps.map(([t, d, Icon], i) => (
          <div key={t} className="relative rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="absolute top-6 right-6 disp text-[40px] font-medium leading-none" style={{ color: "var(--sand)" }}>{i + 1}</div>
            <div className="grid place-items-center w-11 h-11 rounded-xl mb-4" style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)", color: "var(--pine)" }}>
              <Icon size={20} />
            </div>
            <h3 className="text-[17px] font-semibold mb-2" style={{ color: "var(--ink)" }}>{t}</h3>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- features ------------------------------ */

function Features() {
  const hero = [
    ["Margin & waste protection", "A trim-aware purchasing engine that shows the real dollars you're over-buying every run — so you cut cost you couldn't even see before.", TrendingDown],
    ["Frictionless migration", "Import your menu, customers, and subscriptions from a CSV. Switch without the dread — most kitchens move in an afternoon.", Upload],
    ["Loyalty & referrals", "Turn first-time diners into regulars with built-in points and referral rewards that run themselves.", Star],
  ] as const;
  const rest = [
    ["Storefront & subscriptions", "Branded ordering, weekly & biweekly plans, skip / pause / swap.", Store],
    ["Kitchen OS", "Production reports, labels, and packing slips for every run.", ChefHat],
    ["Kitchen display", "Station-by-station tickets so the line always knows what's next.", Monitor],
    ["POS terminal", "Ring up walk-in and in-store orders in seconds.", Wallet],
    ["Inventory & purchasing", "Live stock levels and trim-aware shopping lists.", Boxes],
    ["Delivery routes", "Per-zone manifests your drivers can actually follow.", Truck],
    ["Payments via Stripe", "Connect your own account — money lands straight in your bank.", CreditCard],
    ["Marketing", "Email campaigns, coupons, and gift cards built in.", Mail],
    ["Analytics & retention", "Revenue, top meals, and subscriber churn at a glance.", BarChart3],
  ] as const;

  return (
    <section id="features" className="py-20 md:py-28" style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionKicker>Why PrepFlow</SectionKicker>
        <SectionTitle>Best where it matters most</SectionTitle>
        <p className="text-center text-[15px] mt-4 max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
          We&apos;re unambiguously best at the two things that decide whether your kitchen makes money — and good at everything else.
        </p>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {hero.map(([t, d, Icon]) => (
            <div key={t} className="rounded-2xl p-7" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="grid place-items-center w-12 h-12 rounded-xl mb-5" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                <Icon size={22} />
              </div>
              <h3 className="text-[18px] font-semibold mb-2" style={{ color: "var(--ink)" }}>{t}</h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rest.map(([t, d, Icon]) => (
            <div key={t} className="rounded-xl p-5 flex gap-3.5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--pine)" }}>
                <Icon size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{t}</div>
                <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: "var(--muted)" }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Platform() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-24">
      <div className="rounded-3xl px-8 md:px-14 py-12 md:py-16 text-center" style={{ background: "var(--sidebar)" }}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-[12px] font-medium" style={{ background: "#ffffff12", color: "#ffffffcc" }}>
          <Leaf size={13} /> Replaces your patchwork of tools
        </div>
        <h2 className="disp text-[30px] md:text-[38px] leading-tight font-medium max-w-2xl mx-auto" style={{ color: "#f4f2ec" }}>
          One login instead of six spreadsheets and three logins.
        </h2>
        <p className="mt-4 text-[15px] max-w-xl mx-auto" style={{ color: "#ffffff9a" }}>
          Storefront, POS, kitchen, delivery, marketing, and analytics — designed to work together, priced for independents.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {["Storefront", "Subscriptions", "Kitchen OS", "Purchasing", "POS", "Routes", "Marketing", "Analytics"].map((t) => (
            <span key={t} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium" style={{ background: "#ffffff12", color: "#f4f2ec" }}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- pricing ------------------------------- */

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "$79",
      orders: "Up to 150 orders / mo",
      fee: "1.5% platform fee",
      blurb: "For new & small kitchens finding their feet.",
      highlight: false,
      features: [
        "Branded storefront & meal-plan subscriptions",
        "Kitchen OS: production, labels, packing",
        "Trim-aware purchasing & waste dashboard",
        "One-click migration from your old tool",
        "Loyalty, referrals & email receipts",
      ],
    },
    {
      name: "Growth",
      price: "$199",
      orders: "Unlimited orders",
      fee: "1.25% platform fee",
      blurb: "For kitchens scaling past the early days.",
      highlight: true,
      features: [
        "Everything in Starter",
        "Advanced analytics & retention reports",
        "Delivery zones & route planning",
        "Email campaigns, coupons & gift cards",
        "Priority support",
      ],
    },
    {
      name: "Pro",
      price: "$349",
      orders: "Unlimited orders",
      fee: "1.0% platform fee",
      blurb: "For high-volume & multi-location kitchens.",
      highlight: false,
      features: [
        "Everything in Growth",
        "Invoice scanning — photo to inventory",
        "Courier integration & live tracking",
        "SMS marketing & win-back flows",
        "White-label custom domain",
      ],
    },
  ] as const;

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <SectionKicker>Pricing</SectionKicker>
      <SectionTitle>Simple pricing that grows with you</SectionTitle>
      <p className="text-center text-[15px] mt-4 max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
        Flat monthly plans. Connect your own Stripe account — payments land straight in your bank.
        A small platform fee that shrinks as you grow, and card processing passed through at cost.
      </p>

      <div className="mt-14 grid md:grid-cols-3 gap-6 items-start">
        {tiers.map((t) => (
          <div
            key={t.name}
            className="rounded-2xl p-7 relative"
            style={{
              background: t.highlight ? "var(--pine)" : "var(--surface)",
              border: `1px solid ${t.highlight ? "var(--pine)" : "var(--line)"}`,
              boxShadow: t.highlight ? "0 24px 50px -20px rgba(47,69,54,.5)" : "none",
            }}
          >
            {t.highlight && (
              <span className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-wide" style={{ background: "#ffffff22", color: "#f4f2ec" }}>
                Most popular
              </span>
            )}
            <div className="text-[15px] font-semibold mb-1" style={{ color: t.highlight ? "#f4f2ec" : "var(--ink)" }}>{t.name}</div>
            <div className="text-[12.5px] mb-4" style={{ color: t.highlight ? "#ffffffb0" : "var(--muted)" }}>{t.blurb}</div>
            <div className="flex items-end gap-1 mb-1">
              <span className="disp text-[40px] font-medium leading-none" style={{ color: t.highlight ? "#f4f2ec" : "var(--ink)" }}>{t.price}</span>
              <span className="text-[13px] mb-1" style={{ color: t.highlight ? "#ffffffb0" : "var(--muted)" }}>/ month</span>
            </div>
            <div className="text-[12.5px] mb-5" style={{ color: t.highlight ? "#ffffffcc" : "var(--ink-soft)" }}>
              {t.orders} · {t.fee}
            </div>
            <Link
              href="/sign-up"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[14px] font-medium mb-6"
              style={t.highlight ? { background: "#f4f2ec", color: "var(--pine)" } : { background: "var(--pine)", color: "#f4f2ec" }}
            >
              Start free <ArrowRight size={16} />
            </Link>
            <div className="space-y-2.5">
              {t.features.map((f) => (
                <div key={f} className="flex items-start gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: t.highlight ? "#bcd0bd" : "var(--pine)" }} />
                  <span className="text-[13px] leading-snug" style={{ color: t.highlight ? "#ffffffdd" : "var(--ink-soft)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-[12.5px] mt-8" style={{ color: "var(--muted)" }}>
        Annual billing saves about two months. Start free — no card required. Prices in USD.
      </p>
    </section>
  );
}

function Testimonial() {
  return (
    <section className="py-16" style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="disp text-[24px] md:text-[30px] leading-snug font-medium" style={{ color: "var(--ink)" }}>
          &ldquo;PrepFlow showed us $600 a month we were literally throwing in the trash. It paid for itself the first week.&rdquo;
        </div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="grid place-items-center w-9 h-9 rounded-full disp font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>C</div>
          <div className="text-left">
            <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Carla M.</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>Owner, Greenleaf Kitchen</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-24">
      <div className="rounded-3xl px-8 md:px-14 py-14 text-center" style={{ background: "linear-gradient(135deg, var(--pine), color-mix(in srgb, var(--pine) 70%, #1b1a16))" }}>
        <h2 className="disp text-[30px] md:text-[40px] leading-tight font-medium" style={{ color: "#f4f2ec" }}>
          Stop losing money you can&apos;t see.
        </h2>
        <p className="mt-4 text-[15px] max-w-lg mx-auto" style={{ color: "#ffffffc0" }}>
          Bring your kitchen onto PrepFlow this week. Start free — no card, no contract.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14.5px] font-medium" style={{ background: "#f4f2ec", color: "var(--pine)" }}>
            Start free <ArrowRight size={17} />
          </Link>
          <a href="https://calendly.com/gobie-thina6/30min" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14.5px] font-medium" style={{ border: "1px solid #ffffff40", color: "#f4f2ec" }}>
            Book a demo
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-6xl mx-auto px-6 py-12 grid sm:grid-cols-[1.5fr_1fr_1fr] gap-8">
        <div>
          <Link href="/" className="flex items-center gap-2.5 mb-3">
            <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}><Leaf size={17} color="#f4f2ec" /></div>
            <span className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>PrepFlow</span>
          </Link>
          <p className="text-[13px] max-w-xs" style={{ color: "var(--muted)" }}>The all-in-one platform for independent meal-prep kitchens.</p>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Product</div>
          <div className="space-y-2 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            <a href="#features" className="block">Features</a>
            <a href="#how" className="block">How it works</a>
            <a href="#pricing" className="block">Pricing</a>
            <Link href="/store" className="block">Live storefront</Link>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Get started</div>
          <div className="space-y-2 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            <Link href="/sign-up" className="block">Create account</Link>
            <Link href="/sign-in" className="block">Sign in</Link>
          </div>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "var(--line)" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 text-[12px]" style={{ color: "var(--muted)" }}>
          © 2026 PrepFlow. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
