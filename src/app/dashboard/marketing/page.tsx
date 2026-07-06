import { Tag, Gift, Trash2, Eye, EyeOff } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { CouponForm, GiftCardForm } from "./forms";
import { toggleCoupon, deleteCoupon } from "./actions";

export default async function MarketingPage() {
  const { business } = await requireOwner();
  const [coupons, giftCards] = await Promise.all([
    db.coupon.findMany({ where: { businessId: business.id }, orderBy: { code: "asc" } }),
    db.giftCard.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const couponLabel = (c: (typeof coupons)[number]) =>
    c.type === "percent" ? `${c.value}% off` : `${formatCents(c.value)} off`;
  const giftOutstanding = giftCards.reduce((s, g) => s + g.balanceCents, 0);

  return (
    <Page>
      <Head
        kicker="Marketing"
        title="Promotions"
        sub="Coupons your customers redeem at checkout, and gift cards you issue."
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Coupons */}
        <Card>
          <CardTitle icon={<Tag size={15} />} title="Coupons" note={`${coupons.length} total`} />
          <div className="mb-4 pb-4" style={{ borderBottom: "1px solid var(--line)" }}>
            <CouponForm />
          </div>
          {coupons.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>No coupons yet.</p>
          ) : (
            <div className="space-y-2">
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)", opacity: c.active ? 1 : 0.55 }}>
                  <span className="text-[13px] font-semibold font-mono" style={{ color: "var(--ink)" }}>{c.code}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>{couponLabel(c)}</span>
                  {!c.active && <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: "var(--sand)", color: "var(--muted)" }}>off</span>}
                  <div className="ml-auto flex items-center gap-1.5">
                    <form action={toggleCoupon}>
                      <input type="hidden" name="couponId" value={c.id} />
                      <button type="submit" className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} aria-label={c.active ? "Disable" : "Enable"}>
                        {c.active ? <EyeOff size={13} style={{ color: "var(--muted)" }} /> : <Eye size={13} style={{ color: "var(--pine)" }} />}
                      </button>
                    </form>
                    <form action={deleteCoupon}>
                      <input type="hidden" name="couponId" value={c.id} />
                      <button type="submit" className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} aria-label="Delete">
                        <Trash2 size={13} style={{ color: "var(--clay)" }} />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Gift cards */}
        <Card>
          <CardTitle icon={<Gift size={15} />} title="Gift cards" note={`${formatCents(giftOutstanding)} outstanding`} />
          <div className="mb-4 pb-4" style={{ borderBottom: "1px solid var(--line)" }}>
            <GiftCardForm />
          </div>
          {giftCards.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>No gift cards issued.</p>
          ) : (
            <div className="space-y-2">
              {giftCards.map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <span className="text-[13px] font-semibold font-mono" style={{ color: "var(--ink)" }}>{g.code}</span>
                  {g.recipientEmail && <span className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>{g.recipientEmail}</span>}
                  <div className="ml-auto text-right">
                    <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{formatCents(g.balanceCents)}</div>
                    <div className="text-[10.5px]" style={{ color: "var(--muted)" }}>of {formatCents(g.amountCents)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
