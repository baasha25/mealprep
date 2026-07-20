import { Resend } from "resend";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

// Transactional email via Resend. Gated on the key so the app runs without it —
// when disabled we log what would have been sent instead of failing.
const key = process.env.RESEND_API_KEY ?? "";
export const EMAIL_ENABLED = key.startsWith("re_");
const resend = EMAIL_ENABLED ? new Resend(key) : null;

// Until a kitchen verifies its own domain, the shared test sender works (Resend
// restricts it to the account owner's address in test mode).
const FROM = process.env.EMAIL_FROM || "PrepFlow <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mealprepsoftware.netlify.app";

/* ----------------------------- Shared layout ---------------------------- */

const INK = "#1f1e1a";
const SOFT = "#8a887f";
const LINE = "#e7e4db";

/** One branded shell every email reuses: pine header bar, white card, footer. */
function layout(opts: {
  businessName: string;
  brandColor?: string;
  heading: string;
  subheading?: string;
  bodyHtml: string;
}): string {
  const pine = opts.brandColor || "#2f4536";
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
        <div style="background:${pine};padding:20px 24px;">
          <div style="color:#f4f2ec;font-size:18px;font-weight:600;">${escapeHtml(opts.businessName)}</div>
        </div>
        <div style="padding:24px;">
          <h1 style="margin:0 0 4px;font-size:22px;color:${INK};">${opts.heading}</h1>
          ${opts.subheading ? `<p style="margin:0 0 20px;color:${SOFT};font-size:14px;">${opts.subheading}</p>` : ""}
          ${opts.bodyHtml}
        </div>
      </div>
      <p style="text-align:center;color:#b3b0a6;font-size:11px;margin-top:16px;">Powered by PrepFlow</p>
    </div>
  </body></html>`;
}

/** Send one email through the shared layout. Gated + never throws. */
async function send(opts: {
  to: string;
  subject: string;
  businessName: string;
  brandColor?: string;
  heading: string;
  subheading?: string;
  bodyHtml: string;
}): Promise<void> {
  try {
    if (!opts.to) return;
    const html = layout(opts);
    if (!resend) {
      console.log(`[email:disabled] would send "${opts.subject}" to ${opts.to}`);
      return;
    }
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html });
  } catch (err) {
    console.error(`[email] send failed ("${opts.subject}"):`, err);
  }
}

/* ------------------------- Order-shaped helpers ------------------------- */

type OrderRow = {
  id: string;
  businessId: string;
  fulfillment: string;
  address: string | null;
  subtotalCents: number;
  taxCents: number;
  feesCents: number;
  totalCents: number;
  giftRedeemedCents: number;
  items: { nameSnapshot: string; qty: number; unitPriceCentsSnapshot: number }[];
  customer: { name: string; email: string; phone: string | null } | null;
  business: { name: string; brandColor: string };
};

function itemsTable(items: OrderRow["items"]): string {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;color:${INK};font-size:14px;">${escapeHtml(it.nameSnapshot)} <span style="color:${SOFT};">× ${it.qty}</span></td>
        <td style="padding:8px 0;color:${INK};font-size:14px;text-align:right;">${formatCents(it.unitPriceCentsSnapshot * it.qty)}</td>
      </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};margin-bottom:16px;">${rows}</table>`;
}

function totalsTable(o: OrderRow, chargedLabel: string): string {
  const amount = Math.max(0, o.totalCents - o.giftRedeemedCents);
  const line = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:4px 0;color:${strong ? INK : SOFT};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "600" : "400"};">${label}</td>
      <td style="padding:4px 0;color:${strong ? INK : SOFT};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "600" : "400"};text-align:right;">${value}</td>
    </tr>`;
  return `<table style="width:100%;border-collapse:collapse;">
    ${line("Subtotal", formatCents(o.subtotalCents))}
    ${o.feesCents ? line("Fees", formatCents(o.feesCents)) : ""}
    ${o.taxCents ? line("Tax", formatCents(o.taxCents)) : ""}
    ${o.giftRedeemedCents ? line("Gift card", `− ${formatCents(o.giftRedeemedCents)}`) : ""}
    ${line(chargedLabel, formatCents(amount), true)}
  </table>`;
}

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  return db.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true, business: true },
  }) as unknown as OrderRow | null;
}

/* ------------------------------- Senders -------------------------------- */

/** Customer receipt — sent on the first transition to paid. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const o = await loadOrder(orderId);
  if (!o || !o.customer?.email) return;
  const code = o.id.slice(-6).toUpperCase();
  const firstName = o.customer.name?.split(" ")[0] ?? "there";
  const fulfil = o.fulfillment === "pickup" ? "Pickup" : "Delivery";
  await send({
    to: o.customer.email,
    subject: `Your ${o.business.name} order is confirmed`,
    businessName: o.business.name,
    brandColor: o.business.brandColor,
    heading: `Thanks, ${escapeHtml(firstName)} — your order is confirmed`,
    subheading: `Order #${code} · ${fulfil}${o.address ? ` · ${escapeHtml(o.address)}` : ""}`,
    bodyHtml: `${itemsTable(o.items)}${totalsTable(o, "Total charged")}
      <p style="margin:20px 0 0;color:${SOFT};font-size:13px;">We'll have your meals ready for your next ${o.fulfillment === "pickup" ? "pickup" : "delivery"}. Questions? Just reply to this email.</p>`,
  });
}

/** Owner alert — a new order came in, sent to the kitchen's owner(s). */
export async function sendOwnerNewOrder(orderId: string): Promise<void> {
  const o = await loadOrder(orderId);
  if (!o) return;
  const owner = await db.user.findFirst({
    where: { businessId: o.businessId, role: "owner" },
    select: { email: true },
  });
  if (!owner?.email) return;

  const code = o.id.slice(-6).toUpperCase();
  const fulfil = o.fulfillment === "pickup" ? "Pickup" : "Delivery";
  const contact = o.customer
    ? `${escapeHtml(o.customer.name)} · ${escapeHtml(o.customer.email)}${o.customer.phone ? ` · ${escapeHtml(o.customer.phone)}` : ""}`
    : "—";
  await send({
    to: owner.email,
    subject: `New order #${code} — ${o.business.name}`,
    businessName: o.business.name,
    brandColor: o.business.brandColor,
    heading: `New order · ${formatCents(Math.max(0, o.totalCents - o.giftRedeemedCents))}`,
    subheading: `Order #${code} · ${fulfil}`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:${INK};font-size:14px;"><strong>Customer:</strong> ${contact}</p>
      ${o.address ? `<p style="margin:0 0 14px;color:${INK};font-size:14px;"><strong>Address:</strong> ${escapeHtml(o.address)}</p>` : ""}
      ${itemsTable(o.items)}${totalsTable(o, "Order total")}
      <a href="${APP_URL}/dashboard/orders" style="display:inline-block;margin-top:20px;background:${o.business.brandColor || "#2f4536"};color:#f4f2ec;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">View in dashboard</a>`,
  });
}

/** Welcome email — sent when a new kitchen is created at onboarding. */
export async function sendWelcome(opts: {
  to: string;
  businessName: string;
  brandColor?: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `Welcome to PrepFlow — ${opts.businessName} is live`,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: `Your kitchen is live 🌿`,
    subheading: `Welcome to PrepFlow. Here's how to get your first orders in.`,
    bodyHtml: `
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <tr><td style="padding:6px 0;color:${INK};font-size:14px;">1 · Add your meals in <strong>Menu</strong></td></tr>
        <tr><td style="padding:6px 0;color:${INK};font-size:14px;">2 · Set fees, tax & delivery days in <strong>Settings</strong></td></tr>
        <tr><td style="padding:6px 0;color:${INK};font-size:14px;">3 · Share your storefront link and start taking orders</td></tr>
      </table>
      <a href="${APP_URL}/dashboard" style="display:inline-block;margin-top:16px;background:${opts.brandColor || "#2f4536"};color:#f4f2ec;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Go to your dashboard</a>
      <p style="margin:20px 0 0;color:${SOFT};font-size:13px;">Need a hand? Just reply — we're happy to help you get set up.</p>`,
  });
}

/** Recurring-charge receipt — sent when a subscription invoice is paid. */
export async function sendSubscriptionReceipt(opts: {
  to: string;
  businessName: string;
  brandColor?: string;
  planName: string;
  amountCents: number;
  nextDeliveryLabel?: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `Your ${opts.businessName} subscription renewed`,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: `Subscription renewed`,
    subheading: `${escapeHtml(opts.planName)} · ${formatCents(opts.amountCents)}`,
    bodyHtml: `
      <p style="margin:0 0 8px;color:${INK};font-size:14px;">Thanks — we've charged ${formatCents(opts.amountCents)} for your next cycle.</p>
      ${opts.nextDeliveryLabel ? `<p style="margin:0 0 14px;color:${SOFT};font-size:13px;">Next delivery: ${escapeHtml(opts.nextDeliveryLabel)}</p>` : ""}
      <p style="margin:12px 0 0;color:${SOFT};font-size:13px;">Manage or pause your plan anytime from your account. Questions? Just reply.</p>`,
  });
}

/** Sent the moment a customer subscribes (not webhook-dependent). */
export async function sendSubscriptionConfirmation(opts: {
  to: string;
  customerName: string;
  businessName: string;
  brandColor?: string;
  planName: string;
  nextDeliveryLabel: string;
  accountUrl: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `You're subscribed to ${opts.businessName} 🎉`,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: "You're all set 🎉",
    subheading: `${escapeHtml(opts.planName)} · first delivery ${escapeHtml(opts.nextDeliveryLabel)}`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:${INK};font-size:14px;">Hi ${escapeHtml(opts.customerName)}, thanks for subscribing to ${escapeHtml(opts.businessName)}! Your <strong>${escapeHtml(opts.planName)}</strong> plan is active and your first delivery is set for ${escapeHtml(opts.nextDeliveryLabel)}.</p>
      <p style="margin:0 0 16px;color:${SOFT};font-size:13px;">Head to your account to pick your meals for each delivery — you can skip, pause, or cancel anytime before the cut-off.</p>
      <a href="${opts.accountUrl}" style="display:inline-block;background:${opts.brandColor || "#2f4536"};color:#f4f2ec;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Pick my meals</a>`,
  });
}

/** Dunning — sent when a subscription payment fails. */
export async function sendPaymentFailed(opts: {
  to: string;
  businessName: string;
  brandColor?: string;
  planName: string;
  accountUrl: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `Payment failed — ${opts.businessName}`,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: `We couldn't process your payment`,
    subheading: escapeHtml(opts.planName),
    bodyHtml: `
      <p style="margin:0 0 14px;color:${INK};font-size:14px;">Your latest subscription charge didn't go through. Please update your payment method so your meals keep coming — we'll retry automatically.</p>
      <a href="${opts.accountUrl}" style="display:inline-block;background:${opts.brandColor || "#2f4536"};color:#f4f2ec;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Update payment</a>`,
  });
}

/** Reminder: an upcoming delivery's edit cut-off is approaching. */
export async function sendCutoffReminder(opts: {
  to: string;
  customerName: string;
  businessName: string;
  brandColor?: string;
  deliveryLabel: string;
  accountUrl: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `Pick your meals for ${escapeHtml(opts.deliveryLabel)} — ${opts.businessName}`,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: "Time to pick your meals 🥗",
    subheading: `Choose before ordering closes for ${escapeHtml(opts.deliveryLabel)}.`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:${INK};font-size:14px;">Hi ${escapeHtml(opts.customerName)}, your next ${escapeHtml(opts.businessName)} box is coming up on ${escapeHtml(opts.deliveryLabel)}. Head to your account to <strong>pick your meals</strong> for this delivery — you can also skip, swap, or pause. Ordering closes in about 48 hours, and after that this box is locked in.</p>
      <a href="${opts.accountUrl}" style="display:inline-block;background:${opts.brandColor || "#2f4536"};color:#f4f2ec;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">Pick my meals</a>`,
  });
}

/** Reminder: today is this subscriber's delivery day. */
export async function sendDeliveryDayReminder(opts: {
  to: string;
  customerName: string;
  businessName: string;
  brandColor?: string;
  deliveryLabel: string;
  accountUrl: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `Your ${opts.businessName} meals arrive today`,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: "Your meals arrive today 🍱",
    subheading: `${escapeHtml(opts.deliveryLabel)}`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:${INK};font-size:14px;">Hi ${escapeHtml(opts.customerName)}, heads up — your ${escapeHtml(opts.businessName)} box is scheduled for delivery today. Enjoy your meals!</p>
      <a href="${opts.accountUrl}" style="display:inline-block;background:${opts.brandColor || "#2f4536"};color:#f4f2ec;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">View my plan</a>`,
  });
}

/** Owner marketing campaign — a free-text email to a customer segment. */
export async function sendCampaignEmail(opts: {
  to: string;
  businessName: string;
  brandColor?: string;
  subject: string;
  message: string;
}): Promise<void> {
  const bodyHtml = opts.message
    .split(/\n\n+/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;color:${INK};font-size:14px;line-height:1.55;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  await send({
    to: opts.to,
    subject: opts.subject,
    businessName: opts.businessName,
    brandColor: opts.brandColor,
    heading: escapeHtml(opts.subject),
    bodyHtml,
  });
}

/* ------------------------------- Utils ---------------------------------- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
