import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { getKitchenCustomer } from "@/lib/customer-auth";
import { PUSH_ENABLED } from "@/lib/push";

export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1),
  // From the checkout success page, where the customer isn't signed in but we
  // know who just ordered; ignored when a signed-in customer is present.
  email: z.string().trim().toLowerCase().email().optional(),
  subscription: z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(200) }),
  }),
});

/** Save (or refresh) a browser's push subscription for a kitchen's customer. */
export async function POST(req: NextRequest) {
  if (!PUSH_ENABLED) return NextResponse.json({ ok: false, reason: "push_disabled" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { slug, email, subscription } = parsed.data;
  const business = await getStorefrontBusiness(slug);
  if (!business) return NextResponse.json({ ok: false }, { status: 404 });

  let customerId: string | null = null;
  const { customer } = await getKitchenCustomer(business.id);
  if (customer) customerId = customer.id;
  else if (email) {
    const c = await db.customer.findFirst({ where: { businessId: business.id, email }, select: { id: true } });
    customerId = c?.id ?? null;
  }

  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { businessId: business.id, customerId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null },
    update: { businessId: business.id, ...(customerId ? { customerId } : {}), p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, lastSeenAt: new Date() },
  });
  return NextResponse.json({ ok: true, linked: Boolean(customerId) });
}

/** Forget a browser (the customer turned notifications off). */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 });
  await db.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
