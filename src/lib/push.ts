// Web push to customers who installed a kitchen's storefront and allowed
// notifications. Off unless VAPID keys are set. Subscriptions live in
// PushSubscription; a 404/410 from the push service prunes the row.

import webpush from "web-push";
import { db } from "@/lib/db";

const PUB = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIV = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@prepflow.ca";

export const PUSH_ENABLED = Boolean(PUB && PRIV);
if (PUSH_ENABLED) webpush.setVapidDetails(SUBJECT, PUB, PRIV);

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Send to every browser a customer allowed. Returns how many deliveries were accepted. */
export async function sendPushToCustomer(customerId: string, payload: PushPayload): Promise<number> {
  if (!PUSH_ENABLED) return 0;
  const subs = await db.pushSubscription.findMany({ where: { customerId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else console.error("[push] send failed", code ?? err);
    }
  }
  return sent;
}
