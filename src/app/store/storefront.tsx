"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Minus,
  ShoppingBag,
  Repeat,
  Tag,
  Check,
  Leaf,
  Wheat,
  Milk,
  Nut,
  Fish,
  Star,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { formatCents } from "@/lib/money";
import { computeOrder, type PricingSettings } from "@/lib/pricing";
import {
  lookupCoupon,
  lookupGiftCard,
  lookupLoyalty,
  placeOrder,
  type CouponResult,
  type GiftCardResult,
  type LoyaltyLookup,
} from "./actions";

const ALLERGEN_ICON: Record<string, LucideIcon> = {
  gluten: Wheat,
  dairy: Milk,
  nuts: Nut,
  fish: Fish,
};

export type StoreMeal = {
  id: string;
  name: string;
  description: string | null;
  diet: string | null;
  priceCents: number;
  swatch: string;
  allergens: string[];
  calories: number;
  proteinG: number;
  ratingAvg: number;
  ratingCount: number;
};

export type StoreSettings = PricingSettings & {
  fulfillment: string; // "delivery" | "pickup" | "both"
  pickupLocations: string[];
};

const cardStyle = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;
const inputStyle = {
  borderColor: "var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
} as const;

export function Storefront({
  businessName,
  meals,
  settings,
}: {
  businessName: string;
  meals: StoreMeal[];
  settings: StoreSettings;
}) {
  const diets = useMemo(
    () => ["All", ...Array.from(new Set(meals.map((m) => m.diet).filter(Boolean) as string[]))],
    [meals],
  );
  const [diet, setDiet] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [subscribe, setSubscribe] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [giftCard, setGiftCard] = useState<GiftCardResult | null>(null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    settings.fulfillment === "pickup" ? "pickup" : "delivery",
  );
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", zone: "" });
  const [loyalty, setLoyalty] = useState<LoyaltyLookup | null>(null);
  const [applyLoyalty, setApplyLoyalty] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [placed, setPlaced] = useState<{ orderId: string; subscription: boolean } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const mealById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const list = meals.filter((m) => diet === "All" || m.diet === diet);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id: string) =>
    setCart((c) => {
      const n = (c[id] || 0) - 1;
      const x = { ...c };
      if (n <= 0) delete x[id];
      else x[id] = n;
      return x;
    });

  const lines = Object.entries(cart).map(([id, qty]) => ({
    priceCents: mealById.get(id)?.priceCents ?? 0,
    qty,
  }));
  const appliedCoupon =
    coupon && coupon.valid ? { type: coupon.type, value: coupon.value } : null;
  const redeemCents = applyLoyalty && loyalty?.found ? loyalty.valueCents : 0;
  const totals = computeOrder({ lines, settings, subscribe, coupon: appliedCoupon, redeemCents });
  // Gift card is stored-value tender applied to the final total.
  const giftAppliedCents = giftCard?.valid ? Math.min(giftCard.balanceCents, totals.totalCents) : 0;
  const amountDueCents = Math.max(0, totals.totalCents - giftAppliedCents);

  const applyCoupon = () => {
    startTransition(async () => {
      const result = await lookupCoupon(couponInput);
      setCoupon(result);
    });
  };

  const applyGift = () => {
    startTransition(async () => {
      const result = await lookupGiftCard(giftInput);
      setGiftCard(result);
    });
  };

  // Look up a returning customer's points when they enter their email.
  const checkLoyalty = () => {
    if (!/\S+@\S+\.\S+/.test(form.email)) return;
    startTransition(async () => {
      const r = await lookupLoyalty(form.email);
      setLoyalty(r);
      if (!r.found) setApplyLoyalty(false);
    });
  };

  const checkout = () => {
    setError("");
    startTransition(async () => {
      const result = await placeOrder({
        items: Object.entries(cart).map(([mealId, qty]) => ({ mealId, qty })),
        subscribe,
        couponCode: coupon?.valid ? coupon.code : undefined,
        giftCardCode: giftCard?.valid ? giftCard.code : undefined,
        redeemPoints: applyLoyalty && loyalty?.found ? loyalty.points : 0,
        referralCode: referralInput.trim() || undefined,
        fulfillment,
        customer: form,
      });
      if (result.ok) {
        setPlaced({ orderId: result.orderId, subscription: result.subscription });
        setCart({});
        setCoupon(null);
        setCouponInput("");
        setGiftCard(null);
        setGiftInput("");
        setLoyalty(null);
        setApplyLoyalty(false);
        setReferralInput("");
      } else {
        setError(result.message);
      }
    });
  };

  const subPercent = Math.round(settings.subDiscountBps / 100);
  const canDelivery = settings.fulfillment !== "pickup";
  const canPickup = settings.fulfillment !== "delivery";
  const formValid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email);

  if (placed) {
    return (
      <div className="max-w-md mx-auto text-center py-20 fade">
        <div
          className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5"
          style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}
        >
          <Check size={26} style={{ color: "var(--pine)" }} />
        </div>
        <h2 className="disp text-[26px] font-medium" style={{ color: "var(--ink)" }}>
          Order confirmed
        </h2>
        <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
          Thanks, {form.name.split(" ")[0] || "friend"}! Your{" "}
          {placed.subscription ? "subscription" : "order"} is in. Confirmation #
          {placed.orderId.slice(-6)}.
          {placed.subscription
            ? " You'll be billed each cycle once payment is set up."
            : ""}
        </p>
        <button
          onClick={() => {
            setPlaced(null);
            setForm({ name: "", email: "", phone: "", address: "", zone: "" });
          }}
          className="mt-6 px-4 py-2 rounded-lg text-[13px] font-medium"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
        >
          Start another order
        </button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_356px] gap-6">
      <div>
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {diets.map((d) => (
            <button
              key={d}
              onClick={() => setDiet(d)}
              className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors"
              style={{
                background: diet === d ? "var(--ink)" : "var(--surface)",
                color: diet === d ? "#f4f2ec" : "var(--ink-soft)",
                borderColor: diet === d ? "var(--ink)" : "var(--line)",
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((m) => {
            const qty = cart[m.id] || 0;
            return (
              <div key={m.id} className="rounded-xl border overflow-hidden flex flex-col" style={cardStyle}>
                <div
                  className="h-24 relative grid place-items-center"
                  style={{ background: `${m.swatch}10` }}
                >
                  <Leaf size={26} style={{ color: m.swatch, opacity: 0.5 }} />
                  {m.diet && (
                    <span
                      className="absolute top-3 left-3 text-[10.5px] px-2 py-0.5 rounded"
                      style={{
                        background: "var(--surface)",
                        color: m.swatch,
                        border: `1px solid ${m.swatch}33`,
                      }}
                    >
                      {m.diet}
                    </span>
                  )}
                  {m.allergens.length > 0 && (
                    <div className="absolute top-3 right-3 flex gap-1">
                      {m.allergens.map((a) => {
                        const I = ALLERGEN_ICON[a];
                        return I ? (
                          <span
                            key={a}
                            className="grid place-items-center w-5 h-5 rounded-full"
                            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                            title={`Contains ${a}`}
                          >
                            <I size={11} color={m.swatch} />
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-[14px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
                    {m.name}
                  </h3>
                  {m.description && (
                    <p className="text-[12px] mt-1 mb-2 leading-snug" style={{ color: "var(--muted)" }}>
                      {m.description}
                    </p>
                  )}
                  <div className="text-[11.5px] mb-3 flex items-center gap-2" style={{ color: "var(--muted)" }}>
                    {m.ratingCount > 0 && (
                      <span className="flex items-center gap-0.5" style={{ color: "#c98a2b" }}>
                        <Star size={12} fill="#e0a53f" style={{ color: "#e0a53f" }} />
                        {m.ratingAvg.toFixed(1)}
                        <span style={{ color: "var(--muted)" }}>({m.ratingCount})</span>
                      </span>
                    )}
                    <span>{m.calories} cal · {m.proteinG}g protein</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="disp text-[17px] font-medium" style={{ color: "var(--ink)" }}>
                      {formatCents(m.priceCents)}
                    </span>
                    {qty === 0 ? (
                      <button
                        onClick={() => add(m.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] font-medium"
                        style={{ background: "var(--pine)", color: "#f4f2ec" }}
                      >
                        <Plus size={14} /> Add
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-3 px-2 py-1 rounded-md"
                        style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                      >
                        <button onClick={() => sub(m.id)} aria-label="Remove one">
                          <Minus size={15} style={{ color: "var(--ink)" }} />
                        </button>
                        <span className="text-[13px] font-semibold w-4 text-center" style={{ color: "var(--ink)" }}>
                          {qty}
                        </span>
                        <button onClick={() => add(m.id)} aria-label="Add one">
                          <Plus size={15} style={{ color: "var(--ink)" }} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart + checkout */}
      <aside className="lg:sticky lg:top-6 h-fit">
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={16} style={{ color: "var(--pine)" }} />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Your order
            </h2>
            {totals.itemCount > 0 && (
              <span className="ml-auto text-[12.5px]" style={{ color: "var(--muted)" }}>
                {totals.itemCount} meals
              </span>
            )}
          </div>

          {totals.itemCount === 0 ? (
            <p className="text-[13px] py-9 text-center" style={{ color: "var(--muted)" }}>
              Add meals to start your order.
            </p>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-40 overflow-auto">
                {Object.entries(cart).map(([id, q]) => {
                  const m = mealById.get(id);
                  return m ? (
                    <div key={id} className="flex justify-between text-[13px]">
                      <span className="truncate pr-2" style={{ color: "var(--ink)" }}>
                        {q}× {m.name}
                      </span>
                      <span style={{ color: "var(--muted)" }}>{formatCents(m.priceCents * q)}</span>
                    </div>
                  ) : null;
                })}
              </div>

              <button
                onClick={() => setSubscribe((s) => !s)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border mb-3 text-left transition-colors"
                style={{
                  borderColor: subscribe ? "var(--pine)" : "var(--line)",
                  background: subscribe
                    ? "color-mix(in srgb, var(--pine) 6%, transparent)"
                    : "transparent",
                }}
              >
                <div
                  className="grid place-items-center w-8 h-8 rounded-md shrink-0"
                  style={{ background: subscribe ? "var(--pine)" : "var(--sand)" }}
                >
                  <Repeat size={15} color={subscribe ? "#f4f2ec" : "var(--muted)"} />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    Weekly subscription
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                    Save {subPercent}% every week
                  </div>
                </div>
                <div
                  className="w-9 h-5 rounded-full p-0.5 transition-colors"
                  style={{ background: subscribe ? "var(--pine)" : "#cfc8b5" }}
                >
                  <div
                    className="w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: subscribe ? "translateX(16px)" : "none" }}
                  />
                </div>
              </button>

              <div className="flex gap-2 mb-3">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon — try FRESH10"
                  className="flex-1 px-3 py-2 rounded-md border text-[13px] outline-none"
                  style={inputStyle}
                />
                <button
                  onClick={applyCoupon}
                  disabled={pending}
                  className="px-3 rounded-md text-[13px] font-medium"
                  style={{ background: "var(--sand)", color: "var(--ink)" }}
                >
                  Apply
                </button>
              </div>
              {coupon?.valid && (
                <p className="text-[12px] mb-2 flex items-center gap-1" style={{ color: "var(--pine)" }}>
                  <Tag size={12} />
                  {coupon.code} — {coupon.label}
                </p>
              )}
              {coupon && !coupon.valid && (
                <p className="text-[12px] mb-2" style={{ color: "var(--clay)" }}>
                  {coupon.message}
                </p>
              )}

              <div className="flex gap-2 mb-3">
                <input
                  value={giftInput}
                  onChange={(e) => setGiftInput(e.target.value)}
                  placeholder="Gift card — try GIFT-7K2P"
                  className="flex-1 px-3 py-2 rounded-md border text-[13px] outline-none"
                  style={inputStyle}
                />
                <button
                  onClick={applyGift}
                  disabled={pending}
                  className="px-3 rounded-md text-[13px] font-medium"
                  style={{ background: "var(--sand)", color: "var(--ink)" }}
                >
                  Apply
                </button>
              </div>
              {giftCard?.valid && (
                <p className="text-[12px] mb-2 flex items-center gap-1" style={{ color: "var(--pine)" }}>
                  <Gift size={12} />
                  {giftCard.code} — {formatCents(giftCard.balanceCents)} balance
                </p>
              )}
              {giftCard && !giftCard.valid && (
                <p className="text-[12px] mb-2" style={{ color: "var(--clay)" }}>
                  {giftCard.message}
                </p>
              )}

              <div
                className="space-y-1.5 text-[13px] py-3 border-t border-b mb-3"
                style={{ borderColor: "var(--line)" }}
              >
                <Line l="Subtotal" v={formatCents(totals.subtotalCents)} />
                {totals.subDiscountCents > 0 && (
                  <Line l={`Subscription −${subPercent}%`} v={`−${formatCents(totals.subDiscountCents)}`} green />
                )}
                {totals.couponCents > 0 && (
                  <Line l="Coupon" v={`−${formatCents(totals.couponCents)}`} green />
                )}
                {totals.redeemCents > 0 && (
                  <Line l="Points redeemed" v={`−${formatCents(totals.redeemCents)}`} green />
                )}
                <Line l="Tax" v={formatCents(totals.taxCents)} />
                <Line l="Delivery" v={formatCents(totals.deliveryFeeCents)} />
                <Line l="Processing" v={formatCents(totals.processingFeeCents)} />
              </div>
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                  Total
                </span>
                <span className="disp text-[22px] font-medium" style={{ color: "var(--pine)" }}>
                  {formatCents(totals.totalCents)}
                </span>
              </div>
              {giftAppliedCents > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "var(--muted)" }}>Gift card</span>
                    <span style={{ color: "var(--pine)" }}>−{formatCents(giftAppliedCents)}</span>
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Amount due</span>
                    <span className="disp text-[20px] font-medium" style={{ color: "var(--ink)" }}>{formatCents(amountDueCents)}</span>
                  </div>
                </div>
              )}

              {totals.belowMinimum && (
                <p
                  className="text-[12px] mb-2.5 px-3 py-2 rounded-md"
                  style={{
                    background: "color-mix(in srgb, var(--clay) 9%, transparent)",
                    color: "var(--clay)",
                  }}
                >
                  Minimum order is {formatCents(settings.minOrderCents)} — add{" "}
                  {formatCents(settings.minOrderCents - totals.subtotalCents)} more.
                </p>
              )}

              {/* Fulfillment */}
              {canDelivery && canPickup && (
                <div className="flex gap-2 mb-3">
                  {(["delivery", "pickup"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFulfillment(f)}
                      className="flex-1 py-1.5 rounded-md text-[12.5px] font-medium border capitalize"
                      style={{
                        background: fulfillment === f ? "var(--ink)" : "transparent",
                        color: fulfillment === f ? "#f4f2ec" : "var(--ink-soft)",
                        borderColor: fulfillment === f ? "var(--ink)" : "var(--line)",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}

              {/* Customer details */}
              <div className="space-y-2 mb-3">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-3 py-2 rounded-md border text-[13px] outline-none"
                  style={inputStyle}
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={checkLoyalty}
                  placeholder="Email"
                  type="email"
                  className="w-full px-3 py-2 rounded-md border text-[13px] outline-none"
                  style={inputStyle}
                />
                {fulfillment === "delivery" && (
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Delivery address"
                    className="w-full px-3 py-2 rounded-md border text-[13px] outline-none"
                    style={inputStyle}
                  />
                )}
                <input
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value)}
                  placeholder="Referral code (optional)"
                  className="w-full px-3 py-2 rounded-md border text-[13px] outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Loyalty redemption — shown when a returning customer has points */}
              {loyalty?.found && (
                <button
                  onClick={() => setApplyLoyalty((v) => !v)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border mb-3 text-left transition-colors"
                  style={{
                    borderColor: applyLoyalty ? "var(--pine)" : "var(--line)",
                    background: applyLoyalty ? "color-mix(in srgb, var(--pine) 6%, transparent)" : "transparent",
                  }}
                >
                  <div className="grid place-items-center w-8 h-8 rounded-md shrink-0" style={{ background: applyLoyalty ? "var(--pine)" : "var(--sand)" }}>
                    <Star size={15} color={applyLoyalty ? "#f4f2ec" : "var(--muted)"} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      Redeem {loyalty.points} points
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                      Save up to {formatCents(loyalty.valueCents)} on this order
                    </div>
                  </div>
                  <div className="w-9 h-5 rounded-full p-0.5 transition-colors" style={{ background: applyLoyalty ? "var(--pine)" : "#cfc8b5" }}>
                    <div className="w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: applyLoyalty ? "translateX(16px)" : "none" }} />
                  </div>
                </button>
              )}

              {error && (
                <p className="text-[12px] mb-2" style={{ color: "var(--clay)" }}>
                  {error}
                </p>
              )}

              <button
                onClick={checkout}
                disabled={pending || totals.belowMinimum || !formValid}
                className="w-full py-2.5 rounded-lg font-medium text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  background: totals.belowMinimum || !formValid ? "var(--sand)" : "var(--pine)",
                  color: totals.belowMinimum || !formValid ? "#b3ada0" : "#f4f2ec",
                }}
              >
                {pending ? "Placing…" : subscribe ? "Start subscription" : "Place order"}
              </button>
              <p className="text-[11px] mt-2 text-center" style={{ color: "var(--muted)" }}>
                Payment is collected once Stripe is connected.
              </p>
            </>
          )}
        </div>
        <p className="text-[11px] mt-3 text-center" style={{ color: "var(--muted)" }}>
          Ordering from {businessName}
        </p>
      </aside>
    </div>
  );
}

function Line({ l, v, green }: { l: string; v: string; green?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--muted)" }}>{l}</span>
      <span style={{ color: green ? "var(--pine)" : "var(--ink)" }}>{v}</span>
    </div>
  );
}
