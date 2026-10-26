"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Store, Percent, Truck, Star, Bell, ImagePlus, Loader2, X, UtensilsCrossed } from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { updateSettings, signLogoUpload, type SettingsActionState } from "./actions";
import { TIERS, TIER_KEYS, feePctLabel, type TierKey } from "@/lib/tiers";
import { TIMEZONES } from "@/lib/cutoff";
import { NOUN_OPTIONS } from "@/lib/nouns";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type SettingsInitial = {
  name: string;
  brandColor: string;
  logoUrl: string;
  customDomain: string;
  sharePartnerStats: boolean;
  referredByPartnerName: string | null;
  isPro: boolean;
  tier: TierKey;
  subDiscount: number;
  taxRate: number;
  platformFee: number;
  deliveryFee: number;
  processingFee: number;
  minOrder: number;
  minMeals: number;
  cutoff: string;
  timezone: string;
  fulfillment: "delivery" | "pickup" | "both";
  deliveryDays: Record<string, boolean>;
  subscriptionsOnly: boolean;
  subNoPick: "skip" | "chef_choice";
  itemNoun: string;
  pickupLocations: string[];
  loyaltyEnabled: boolean;
  autoApproveReviews: boolean;
  notifyCutoff: boolean;
  notifyDeliveryDay: boolean;
  notifyAbandoned: boolean;
  notifyWinBack: boolean;
  winBackDays: number;
  winBackCouponCode: string;
  notifyReviewRequest: boolean;
  googleReviewUrl: string;
  reviewRequestDays: number;
  adminMinutesPerOrder: number;
  cateringEnabled: boolean;
  cateringLeadDays: number;
  cateringMinMeals: number;
  cateringIntro: string;
  storeTagline: string;
  storeDescription: string;
  serviceArea: string;
  postalCode: string;
  storeUrl: string | null;
  loyaltyPointsPerDollar: number;
  loyaltyRedeemCentsPerPoint: number;
  referralBonusPoints: number;
};

const inputStyle = {
  borderColor: "var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
} as const;

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>
      {msg}
    </p>
  );
}

/**
 * Merchant logo uploader. The file goes straight from the browser to Cloudinary
 * (signed on the server); we keep only the returned URL in a hidden field the
 * form submits. The preview sits on a subtle checker so a transparent logo reads
 * clearly. Degrades to a "not set up" note when Cloudinary isn't configured.
 */
function LogoUploadField({ initial }: { initial: string }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, SVG, JPG, or WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That logo is over 5 MB. Please choose a smaller file.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const sig = await signLogoUpload();
      if (!sig.ok) {
        setError(sig.message);
        return;
      }
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("signature", sig.signature);
      body.append("folder", sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) {
        setError("Upload failed. Please try again.");
        return;
      }
      setUrl(data.secure_url as string);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field
      label="Logo"
      className="mt-4"
      hint="Shown on your storefront header and in your dashboard. A PNG or SVG with a transparent background looks best — at least 200px tall."
    >
      <input type="hidden" name="logoUrl" value={url} />
      <div className="flex items-center gap-3">
        <div
          className="relative w-40 h-20 rounded-lg overflow-hidden grid place-items-center shrink-0"
          style={{
            border: "1px solid var(--line)",
            background:
              "repeating-conic-gradient(#0000000d 0% 25%, transparent 0% 50%) 50% / 16px 16px, var(--paper)",
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Logo preview" className="max-w-[88%] max-h-[80%] object-contain" />
          ) : (
            <ImagePlus size={20} style={{ color: "var(--muted)" }} />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center" style={{ background: "#00000055" }}>
              <Loader2 size={18} className="animate-spin" color="#fff" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-60"
            style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            <ImagePlus size={14} /> {busy ? "Uploading…" : url ? "Replace logo" : "Upload logo"}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--clay)" }}
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {error && (
        <p className="text-[11.5px] mt-2" style={{ color: "var(--clay)" }}>
          {error}
        </p>
      )}
    </Field>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(updateSettings, { ok: false });
  const errors = state.errors ?? {};
  const [tier, setTier] = useState<TierKey>(initial.tier);

  return (
    <form action={formAction} className="space-y-4">
      {/* Brand */}
      <Card>
        <CardTitle icon={<Store size={15} />} title="Brand" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name">
            <input
              name="name"
              defaultValue={initial.name}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.name} />
          </Field>
          <Field label="Brand color" hint="Drives the dashboard accent (--pine).">
            <div className="flex items-center gap-2">
              <input
                type="color"
                name="brandColor"
                defaultValue={initial.brandColor}
                className="h-9 w-12 rounded-md border cursor-pointer"
                style={{ borderColor: "var(--line)" }}
                onChange={(e) => {
                  const hex = e.currentTarget.parentElement?.querySelector<HTMLInputElement>(
                    "input[data-hex]",
                  );
                  if (hex) hex.value = e.currentTarget.value;
                }}
              />
              <input
                data-hex
                name="brandColorHex"
                defaultValue={initial.brandColor}
                className={INP}
                style={inputStyle}
                readOnly
              />
            </div>
            <ErrorText msg={errors.brandColor} />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="What you sell" hint="Changes the word customers and your kitchen screens use: 'Add 3 portions', 'Pick 10 pouches', 'bottles out'. Prices, plans and recipes are unchanged.">
            <select name="itemNoun" defaultValue={initial.itemNoun} className={INP} style={inputStyle}>
              {NOUN_OPTIONS.map((n) => (
                <option key={n.key} value={n.key}>{n.many.charAt(0).toUpperCase() + n.many.slice(1)} — {n.hint}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Custom domain (your own URL)"
            hint={
              initial.isPro
                ? "e.g. order.yourkitchen.com — at your domain provider add a CNAME pointing it to prepflow.ca, save here, then tell support and we switch it on (usually within a business day). Your existing website stays where it is; only ordering moves."
                : "Serve your storefront on your own domain, e.g. order.yourkitchen.com. Available on the Pro plan — you can save it now and it activates when you upgrade."
            }
          >
            <input name="customDomain" defaultValue={initial.customDomain} placeholder="order.yourkitchen.com" className={INP} style={inputStyle} />
            <ErrorText msg={errors.customDomain} />
          </Field>
        </div>
        <LogoUploadField initial={initial.logoUrl} />

        {/* Search & link previews — what Google and shared links show for the storefront */}
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Search &amp; link previews</div>
          <p className="text-[12px] mt-0.5 mb-3" style={{ color: "var(--muted)" }}>
            Your storefront and every meal already have their own Google-ready page (title, description, prices, nutrition, verified ratings, sitemap).
            These three fields make them read like you, and help people searching in your area find you.
            {initial.storeUrl && (
              <>
                {" "}Sitemap:{" "}
                <a href={`${initial.storeUrl}/sitemap.xml`} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--pine)" }}>
                  {initial.storeUrl}/sitemap.xml
                </a>
              </>
            )}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Service area" hint="City or region you deliver to, e.g. Mississauga & Oakville. Goes in your page title: “<name> · Meal prep in Mississauga & Oakville, delivered”.">
              <input name="serviceArea" defaultValue={initial.serviceArea} placeholder="Durham Region" maxLength={80} className={INP} style={inputStyle} />
              <ErrorText msg={errors.serviceArea} />
            </Field>
            <Field label="Kitchen postal code" hint="Where you cook from. Opens Nearby prices on your own area and sets sensible defaults. Never shown to customers.">
              <input name="postalCode" defaultValue={initial.postalCode} placeholder="V6E 1A1" maxLength={12} autoComplete="postal-code" className={INP} style={inputStyle} />
              <ErrorText msg={errors.postalCode} />
            </Field>
            <Field label="Tagline (one line)" hint="Shown under your name on the storefront, e.g. “Chef-made meal prep, delivered Mondays & Thursdays”.">
              <input name="storeTagline" defaultValue={initial.storeTagline} placeholder="Fresh meals, made to order" maxLength={90} className={INP} style={inputStyle} />
              <ErrorText msg={errors.storeTagline} />
            </Field>
          </div>
          <Field className="mt-4" label="Search description" hint="The sentence under your link in Google and in shared links (about 160 characters). Leave blank and we write one from your menu, delivery days and area.">
            <textarea name="storeDescription" defaultValue={initial.storeDescription} rows={2} maxLength={200} className={INP} style={inputStyle} placeholder="Macro-balanced meals cooked fresh every Sunday in Whitby. Pick your meals, order once or subscribe, delivered Monday across Durham." />
            <ErrorText msg={errors.storeDescription} />
          </Field>
        </div>
      </Card>

      {/* Pricing & fees */}
      <Card>
        <CardTitle
          icon={<Percent size={15} />}
          title="Pricing & fees"
          note="Stored as integer cents / basis points"
        />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Subscription discount (%)" hint="The discount subscribers get vs. ordering one-off — applied to their subtotal before tax.">
            <input
              name="subDiscount"
              type="number"
              step="0.01"
              defaultValue={initial.subDiscount}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.subDiscount} />
          </Field>
          <Field label="Tax rate (%)" hint="Sales tax charged to customers, on the discounted subtotal. Use your local rate (e.g. 13% HST).">
            <input
              name="taxRate"
              type="number"
              step="0.01"
              defaultValue={initial.taxRate}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.taxRate} />
          </Field>
          <Field
            label="PrepFlow plan"
            hint={`Sets your platform fee automatically — ${feePctLabel(tier)}.`}
          >
            <input type="hidden" name="tier" value={tier} />
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
              {TIER_KEYS.map((k) => {
                const on = tier === k;
                return (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setTier(k)}
                    className="flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors"
                    style={{ background: on ? "var(--pine)" : "transparent", color: on ? "#f4f2ec" : "var(--muted)" }}
                    title={`$${Math.round(TIERS[k].priceCents / 100)}/mo · ${feePctLabel(k)} fee`}
                  >
                    {TIERS[k].name}
                  </button>
                );
              })}
            </div>
            <ErrorText msg={errors.tier} />
          </Field>
          <Field label="Delivery fee ($)" hint="Flat fee added to delivery orders.">
            <input
              name="deliveryFee"
              type="number"
              step="0.01"
              defaultValue={initial.deliveryFee}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.deliveryFee} />
          </Field>
          <Field label="Processing fee ($)" hint="Flat per-order fee (e.g. packaging/handling). Separate from Stripe's card processing.">
            <input
              name="processingFee"
              type="number"
              step="0.01"
              defaultValue={initial.processingFee}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.processingFee} />
          </Field>
          <Field label="Minimum order ($)" hint="Orders below this can't check out. 0 = no minimum.">
            <input
              name="minOrder"
              type="number"
              step="0.01"
              defaultValue={initial.minOrder}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.minOrder} />
          </Field>
          <Field label="Minimum meals / order" hint="Fewest meals a one-time order can contain. 0 = no minimum. Subscriptions follow their plan instead.">
            <input
              name="minMeals"
              type="number"
              step="1"
              defaultValue={initial.minMeals}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.minMeals} />
          </Field>
        </div>
      </Card>

      {/* Fulfillment */}
      <Card>
        <CardTitle icon={<Truck size={15} />} title="Fulfillment" />
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Order cut-off" hint="One rule for everything: a weekday and time, e.g. Fri 8:00 PM. Every delivery in the week after it locks at that moment — subscribers' picks, skips and swaps, the storefront countdown, the reminder emails, and when picks turn into orders.">
            <input
              name="cutoff"
              defaultValue={initial.cutoff}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.cutoff} />
          </Field>
          <Field label="Cut-off timezone" hint="The timezone your cut-off time is in — powers the countdown clock shown on your storefront.">
            <select name="timezone" defaultValue={initial.timezone} className={INP} style={inputStyle}>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Fulfillment options">
            <select
              name="fulfillment"
              defaultValue={initial.fulfillment}
              className={INP}
              style={inputStyle}
            >
              <option value="both">Delivery & pickup</option>
              <option value="delivery">Delivery only</option>
              <option value="pickup">Pickup only</option>
            </select>
            <ErrorText msg={errors.fulfillment} />
          </Field>
        </div>
        <Field
          label="Delivery days"
          hint="The days your kitchen delivers. Subscribers pick which of these they want — one day, or several to split their week."
          className="mb-4"
        >
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <label
                key={d}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12.5px] cursor-pointer select-none"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <input
                  type="checkbox"
                  name={`day_${d}`}
                  defaultChecked={initial.deliveryDays[d] ?? false}
                />
                {d}
              </label>
            ))}
          </div>
        </Field>
        <div id="subscriptions" className="scroll-mt-6" />
        <div className="rounded-lg border p-3.5 mb-4" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
          <div className="text-[13px] font-semibold mb-2" style={{ color: "var(--ink)" }}>Meal-plan subscriptions</div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" name="subscriptionsOnly" defaultChecked={initial.subscriptionsOnly} className="mt-0.5" />
            <span>
              <span className="text-[13px] font-medium block" style={{ color: "var(--ink)" }}>Sell meal plans only (no one-time orders)</span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                Your storefront leads with your plans and shows the menu as &ldquo;This week&rsquo;s menu&rdquo; &mdash; what subscribers choose from in their account. The one-time cart and Add buttons are hidden. POS and catering are unaffected.
              </span>
            </span>
          </label>
          <div className="mt-3">
            <div className="text-[12.5px] font-medium mb-1" style={{ color: "var(--ink)" }}>If a subscriber hasn&rsquo;t picked by the cut-off</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-[12.5px] cursor-pointer" style={{ color: "var(--ink)" }}>
                <input type="radio" name="subNoPick" value="chef_choice" defaultChecked={initial.subNoPick !== "skip"} /> Auto-pick from their order history
              </label>
              <label className="flex items-center gap-1.5 text-[12.5px] cursor-pointer" style={{ color: "var(--ink)" }}>
                <input type="radio" name="subNoPick" value="skip" defaultChecked={initial.subNoPick === "skip"} /> Skip them that week
              </label>
            </div>
            <p className="text-[11.5px] mt-1.5" style={{ color: "var(--muted)" }}>
              Auto-pick builds a random mix of meals they&rsquo;ve had before (favourites come up more often), filling exactly their plan &mdash; never extras. A brand-new subscriber with no history gets your most-ordered meals. Either way, once a delivery&rsquo;s cut-off passes, picks are locked and each subscriber&rsquo;s meals become a paid order in Orders, Kitchen OS, Routes and Labels &mdash; grouped by zone.
            </p>
          </div>
        </div>
        <Field label="Pickup locations" hint="One per line.">
          <textarea
            name="pickupLocations"
            rows={3}
            defaultValue={initial.pickupLocations.join("\n")}
            className={`${INP} resize-y`}
            style={inputStyle}
          />
        </Field>
      </Card>

      {/* Loyalty & referrals */}

      {/* Catering & large orders */}
      <Card>
        <div id="catering" className="scroll-mt-6" />
        <CardTitle icon={<UtensilsCrossed size={15} />} title="Catering & large orders" note="Quote first, charge after approval" />
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" name="cateringEnabled" defaultChecked={initial.cateringEnabled} className="mt-0.5" />
          <span>
            <span className="text-[13px] font-medium block" style={{ color: "var(--ink)" }}>Take catering requests on the storefront</span>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              Adds a &ldquo;Catering &amp; large orders&rdquo; page where offices and event planners pick a date, headcount and meals (or describe what they need). You build a quote in Sales &rarr; Catering; they approve and pay by card, or you record an e-transfer. Nothing is charged before you confirm.
            </span>
          </span>
        </label>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Minimum notice (days)" hint="The earliest event date a customer can pick, counted from today in your timezone.">
            <input name="cateringLeadDays" type="number" min={0} max={60} defaultValue={initial.cateringLeadDays} className={INP} style={inputStyle} />
            <ErrorText msg={errors.cateringLeadDays} />
          </Field>
          <Field label="Minimum meals" hint="Below this, a customer must describe what they need instead of picking meals (you still get the request).">
            <input name="cateringMinMeals" type="number" min={0} max={1000} defaultValue={initial.cateringMinMeals} className={INP} style={inputStyle} />
            <ErrorText msg={errors.cateringMinMeals} />
          </Field>
        </div>
        <Field className="mt-4" label="Intro on the catering page (optional)" hint="One or two sentences. Blank = a sensible default mentioning your kitchen name.">
          <textarea name="cateringIntro" defaultValue={initial.cateringIntro} rows={2} maxLength={300} className={INP} style={inputStyle} placeholder="Boxed lunches, family-style trays and breakfast spreads for offices and events across Durham. Dietary needs welcome." />
          <ErrorText msg={errors.cateringIntro} />
        </Field>
      </Card>
      <Card>
        <Card>
        <CardTitle icon={<Star size={15} />} title="Customer reviews" />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" name="autoApproveReviews" defaultChecked={initial.autoApproveReviews} />
          <span className="text-[13px]" style={{ color: "var(--ink)" }}>
            Publish reviews automatically (skip manual approval)
          </span>
        </label>
        <p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
          Off (recommended): every review waits in Sales → Reviews until you approve it. On: reviews go live instantly; you can still hide any review or reply.
        </p>
      </Card>

      <CardTitle icon={<Star size={15} />} title="Loyalty & referrals" />
        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input type="checkbox" name="loyaltyEnabled" defaultChecked={initial.loyaltyEnabled} />
          <span className="text-[13px]" style={{ color: "var(--ink)" }}>
            Enable loyalty points & referrals
          </span>
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Points earned per $1" hint="Loyalty points a customer earns per $1 of order subtotal (before discounts).">
            <input
              name="loyaltyPointsPerDollar"
              type="number"
              step="1"
              min="0"
              defaultValue={initial.loyaltyPointsPerDollar}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.loyaltyPointsPerDollar} />
          </Field>
          <Field label="Redemption value (¢ / point)" hint="e.g. 5 = 1 point is worth 5¢.">
            <input
              name="loyaltyRedeemCentsPerPoint"
              type="number"
              step="1"
              min="1"
              defaultValue={initial.loyaltyRedeemCentsPerPoint}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.loyaltyRedeemCentsPerPoint} />
          </Field>
          <Field label="Referral bonus (points)" hint="Awarded to the referrer per signup.">
            <input
              name="referralBonusPoints"
              type="number"
              step="1"
              min="0"
              defaultValue={initial.referralBonusPoints}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.referralBonusPoints} />
          </Field>
        </div>
      </Card>

      {/* Customer notifications */}
      <Card>
        <CardTitle icon={<Bell size={15} />} title="Customer notifications" />
        <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
          Automatic reminders emailed to your subscribers around each delivery.
        </p>
        <label className="flex items-start gap-2 mb-2.5 cursor-pointer select-none">
          <input type="checkbox" name="notifyCutoff" defaultChecked={initial.notifyCutoff} className="mt-0.5" />
          <span>
            <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Cut-off reminder</span>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>“Edit your box before cut-off” — sent ~1 day before changes lock.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input type="checkbox" name="notifyDeliveryDay" defaultChecked={initial.notifyDeliveryDay} className="mt-0.5" />
          <span>
            <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Delivery-day email</span>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>“Your meals arrive today” — sent the morning of delivery.</span>
          </span>
        </label>
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
          <p className="text-[12.5px] mb-2.5" style={{ color: "var(--muted)" }}>Retention — automatic emails that bring customers back.</p>
          <label className="flex items-start gap-2 mb-2.5 cursor-pointer select-none">
            <input type="checkbox" name="notifyAbandoned" defaultChecked={initial.notifyAbandoned} className="mt-0.5" />
            <span>
              <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Abandoned-checkout nudge</span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>“Your order is still waiting” — sent once, 2–48 hours after someone starts checkout but doesn&rsquo;t pay.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" name="notifyWinBack" defaultChecked={initial.notifyWinBack} className="mt-0.5" />
            <span>
              <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Win-back email</span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>“We&rsquo;ve missed you” — to customers with no active plan after the quiet period below. At most once per 90 days per customer.</span>
            </span>
          </label>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <Field label="Quiet days before win-back" hint="Days since a customer's last paid order before we reach out (7–365).">
              <input name="winBackDays" type="number" min="7" max="365" defaultValue={initial.winBackDays} className={INP} style={inputStyle} />
            </Field>
            <Field label="Win-back coupon code (optional)" hint="A coupon from Marketing to include in the email, e.g. COMEBACK10.">
              <input name="winBackCouponCode" defaultValue={initial.winBackCouponCode} placeholder="COMEBACK10" className={INP} style={inputStyle} />
            </Field>
          </div>
          <label className="flex items-start gap-2 mt-4 cursor-pointer select-none">
            <input type="checkbox" name="notifyReviewRequest" defaultChecked={initial.notifyReviewRequest} className="mt-0.5" />
            <span>
              <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Google review request</span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>“How was your order?” with a button to your Google review page, a few days after each delivered order. At most one per customer per 30 days. Needs your review link below.</span>
            </span>
          </label>
          <div className="grid sm:grid-cols-[1fr_160px] gap-4 mt-3">
            <Field label="Your Google review link" hint="Google Business Profile → Ask for reviews → copy the link (it looks like g.page/r/…/review).">
              <input name="googleReviewUrl" type="url" defaultValue={initial.googleReviewUrl} placeholder="https://g.page/r/…/review" className={INP} style={inputStyle} />
              <ErrorText msg={errors.googleReviewUrl} />
            </Field>
            <Field label="Days after delivery" hint="1–14. Two is typical: they've eaten it, it's still fresh.">
              <input name="reviewRequestDays" type="number" min="1" max="14" defaultValue={initial.reviewRequestDays} className={INP} style={inputStyle} />
            </Field>
          </div>
        </div>
        {initial.referredByPartnerName && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="text-[12.5px] mb-2.5" style={{ color: "var(--muted)" }}>Your referral partner</p>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input type="checkbox" name="sharePartnerStats" defaultChecked={initial.sharePartnerStats} className="mt-0.5" />
              <span>
                <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Share my monthly totals with {initial.referredByPartnerName}</span>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {initial.referredByPartnerName} referred you to PrepFlow. With this on, they can see your monthly sales total and order count on their partner page, so they can coach you from real numbers. Never your customers, recipes or anything else. Off by default; turn it off any time.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
          <Field label="Minutes a manual order used to take you" hint="Used only for the 'admin time saved' estimate in Reports → Monthly value report. Tallying, keying in, labelling — be honest, it's your number.">
            <input name="adminMinutesPerOrder" type="number" min="0" max="60" defaultValue={initial.adminMinutesPerOrder} className={`${INP} w-28`} style={inputStyle} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
          style={btnPrimary}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.ok && state.message && (
          <span
            className="flex items-center gap-1 text-[13px]"
            style={{ color: "#5e7350" }}
          >
            <Check size={15} /> {state.message}
          </span>
        )}
        {!state.ok && state.message && (
          <span className="text-[13px]" style={{ color: "var(--clay)" }}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
