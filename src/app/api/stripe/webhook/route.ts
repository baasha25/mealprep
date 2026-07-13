import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { db } from "@/lib/db";
import { ensureSubscriptionFromCheckout } from "@/lib/billing";
import { advanceDeliveryDate } from "@/lib/subscriptions";
import { sendSubscriptionReceipt, sendPaymentFailed } from "@/lib/email";

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
        // Reflect Stripe-side pause/resume (e.g. from the dashboard) in our status.
        const paused = Boolean(stripeSub.pause_collection);
        const status = stripeSub.status === "canceled" ? "canceled" : paused ? "paused" : "active";
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSub.id, status: { not: "canceled" } },
          data: { status },
        });
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
