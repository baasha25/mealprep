import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { db } from "@/lib/db";
import { ensureSubscriptionFromCheckout } from "@/lib/billing";
import { advanceDeliveryDate } from "@/lib/subscriptions";
import { sendSubscriptionReceipt, sendPaymentFailed, sendKitchenBillingPaymentFailed } from "@/lib/email";
import { isTierKey } from "@/lib/tiers";
import { tierFromPriceId, type BillingStatus } from "@/lib/kitchen-billing";
import { activateKitchenSubscription, setKitchenBillingStatus } from "@/lib/kitchen-billing-sync";

/** Find the kitchen whose SOFTWARE subscription this Stripe sub id belongs to. */
async function kitchenForSub(stripeSubId: string | undefined) {
  if (!stripeSubId) return null;
  return db.business.findFirst({
    where: { billingSubscriptionId: stripeSubId },
    select: { id: true, name: true, brandColor: true, slug: true },
  });
}

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mealprepsoftware.netlify.app";

/**
 * Stripe webhook — the recurring subscription lifecycle. Activates once
 * STRIPE_WEBHOOK_SECRET is set (until then it 200s so Stripe doesn't retry).
 * Handles: subscription created, each recurring charge, failed payments, and
 * cancellations. Always returns 200 on handled events so Stripe stops retrying.
 */
export async function POST(req: NextRequest) {
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!STRIPE_ENABLED || !whsec) {
    console.log("[webhook] Stripe webhook not configured — ignoring event.");
    return NextResponse.json({ received: true, configured: false });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whsec);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Kitchen software billing (kitchen → PrepFlow) vs diner meal-plans.
        if (session.metadata?.kind === "kitchen_billing") {
          const businessId = session.metadata.businessId;
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          const tier = session.metadata.tier;
          if (businessId && subId && isTierKey(tier)) {
            await activateKitchenSubscription({ businessId, subscriptionId: subId, tier });
          }
          break;
        }
        if (session.mode === "subscription") {
          await ensureSubscriptionFromCheckout(session);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
          billing_reason?: string;
        };
        const stripeSubIdAny =
          typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        // Kitchen software renewal → keep the kitchen active.
        const kbiz = await kitchenForSub(stripeSubIdAny);
        if (kbiz) {
          await setKitchenBillingStatus(stripeSubIdAny!, "active");
          break;
        }
        // Only act on recurring cycles — the first charge is covered at signup.
        if (invoice.billing_reason === "subscription_cycle") {
          const stripeSubId =
            typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
          if (stripeSubId) {
            const sub = await db.subscription.findFirst({
              where: { stripeSubscriptionId: stripeSubId },
              include: { customer: true, plan: true },
            });
            if (sub && sub.status !== "canceled") {
              const business = await db.business.findUnique({ where: { id: sub.businessId } });
              const nextDate = advanceDeliveryDate(
                sub.nextDeliveryDate ?? new Date(),
                sub.frequency as "weekly" | "biweekly",
              );
              await db.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: nextDate } });
              if (sub.customer?.email && business) {
                await sendSubscriptionReceipt({
                  to: sub.customer.email,
                  businessName: business.name,
                  brandColor: business.brandColor,
                  planName: sub.plan.name,
                  amountCents: invoice.amount_paid ?? 0,
                  nextDeliveryLabel: nextDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  }),
                });
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const stripeSubId =
          typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        // Kitchen software charge failed → past_due + owner dunning.
        const kbizFail = await kitchenForSub(stripeSubId);
        if (kbizFail) {
          await setKitchenBillingStatus(stripeSubId!, "past_due");
          const owner = await db.user.findFirst({
            where: { businessId: kbizFail.id, role: "owner" },
            select: { email: true },
          });
          if (owner?.email) {
            await sendKitchenBillingPaymentFailed({
              to: owner.email,
              kitchenName: kbizFail.name,
              billingUrl: `${APP_URL}/dashboard/billing`,
            });
          }
          break;
        }
        if (stripeSubId) {
          const sub = await db.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId },
            include: { customer: true, plan: true },
          });
          if (sub?.customer?.email) {
            const business = await db.business.findUnique({ where: { id: sub.businessId } });
            if (business) {
              await sendPaymentFailed({
                to: sub.customer.email,
                businessName: business.name,
                brandColor: business.brandColor,
                planName: sub.plan.name,
                accountUrl: `${APP_URL}/store/${business.slug ?? ""}/account`,
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        if (await kitchenForSub(stripeSub.id)) {
          await setKitchenBillingStatus(stripeSub.id, "canceled");
          break;
        }
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSub.id },
          data: { status: "canceled" },
        });
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription & {
          pause_collection?: { behavior: string } | null;
        };
        // Kitchen software subscription: sync status + tier (portal plan switches).
        if (await kitchenForSub(stripeSub.id)) {
          const s = stripeSub.status;
          const status: BillingStatus =
            s === "active" || s === "trialing" ? "active" : s === "past_due" || s === "unpaid" ? "past_due" : s === "canceled" ? "canceled" : "none";
          const tier = tierFromPriceId(stripeSub.items?.data?.[0]?.price?.id);
          await setKitchenBillingStatus(stripeSub.id, status, tier);
          break;
        }
        // Reflect Stripe-side pause/resume (e.g. from the dashboard) in our status.
        const paused = Boolean(stripeSub.pause_collection);
        const status = stripeSub.status === "canceled" ? "canceled" : paused ? "paused" : "active";
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSub.id, status: { not: "canceled" } },
          data: { status },
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (pi) {
          const payment = await db.payment.findFirst({ where: { stripePaymentIntentId: pi } });
          if (payment) {
            const fully = (charge.amount_refunded ?? 0) >= payment.amountCents;
            await db.payment.update({
              where: { id: payment.id },
              data: { refundedAmountCents: charge.amount_refunded ?? 0, status: fully ? "refunded" : "partially_refunded" },
            });
            if (fully) {
              await db.order.updateMany({ where: { id: payment.orderId, status: { not: "canceled" } }, data: { status: "refunded" } });
            }
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook] handler error for ${event.type}:`, err);
    // Return 200 anyway — a retry won't fix a data bug, and we've logged it.
  }

  return NextResponse.json({ received: true });
}
