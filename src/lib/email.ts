import { Resend } from "resend";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

// Transactional email via Resend. Gated on the key so the app runs without it —
// when disabled we log what would have been sent instead of failing.
const key = process.env.RESEND_API_KEY ?? "";
export const EMAIL_ENABLED = key.startsWith("re_");
const resend = EMAIL_ENABLED ? new Resend(key) : null;

// Until the kitchen verifies its own domain in Resend, the shared test sender
// works (Resend restricts it to the account owner's address in test mode).
const FROM = process.env.EMAIL_FROM || "PrepFlow <onboarding@resend.dev>";

/**
 * Send the order-confirmation / receipt email for a paid order. Loads the order
 * with its items, customer, and kitchen. Safe to call more than once per order
 * only if the caller guards on the paid transition (we don't dedupe here).
 * Never throws — email failures must not break checkout.
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true, business: true },
    });
    if (!order || !order.customer?.email) return;

    const subject = `Your ${order.business.name} order is confirmed`;
    const html = renderOrderEmail(order);

    if (!resend) {
      console.log(
        `[email:disabled] would send "${subject}" to ${order.customer.email} (order ${order.id.slice(-6)})`,
      );
      return;
    }

    await resend.emails.send({
      from: FROM,
      to: order.customer.email,
      subject,
      html,
    });
  } catch (err) {
    console.error("[email] order confirmation failed:", err);
  }
}

type OrderEmail = {
  id: string;
  fulfillment: string;
  address: string | null;
  subtotalCents: number;
  taxCents: number;
  feesCents: number;
  totalCents: number;
  giftRedeemedCents: number;
  items: { nameSnapshot: string; qty: number; unitPriceCentsSnapshot: number }[];
  customer: { name: string } | null;
  business: { name: string; brandColor: string };
};

function renderOrderEmail(o: OrderEmail): string {
  const pine = o.business.brandColor || "#2f4536";
  const code = o.id.slice(-6).toUpperCase();
  const firstName = o.customer?.name?.split(" ")[0] ?? "there";
  const amountCharged = Math.max(0, o.totalCents - o.giftRedeemedCents);

  const rows = o.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;color:#1f1e1a;font-size:14px;">${escapeHtml(it.nameSnapshot)} <span style="color:#8a887f;">× ${it.qty}</span></td>
        <td style="padding:8px 0;color:#1f1e1a;font-size:14px;text-align:right;">${formatCents(it.unitPriceCentsSnapshot * it.qty)}</td>
      </tr>`,
    )
    .join("");

  const line = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:4px 0;color:${strong ? "#1f1e1a" : "#8a887f"};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "600" : "400"};">${label}</td>
      <td style="padding:4px 0;color:${strong ? "#1f1e1a" : "#8a887f"};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "600" : "400"};text-align:right;">${value}</td>
    </tr>`;

  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e7e4db;border-radius:14px;overflow:hidden;">
        <div style="background:${pine};padding:20px 24px;">
          <div style="color:#f4f2ec;font-size:18px;font-weight:600;">${escapeHtml(o.business.name)}</div>
        </div>
        <div style="padding:24px;">
          <h1 style="margin:0 0 4px;font-size:22px;color:#1f1e1a;">Thanks, ${escapeHtml(firstName)} — your order is confirmed</h1>
          <p style="margin:0 0 20px;color:#8a887f;font-size:14px;">Order #${code} · ${o.fulfillment === "pickup" ? "Pickup" : "Delivery"}${o.address ? ` · ${escapeHtml(o.address)}` : ""}</p>

          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7e4db;border-bottom:1px solid #e7e4db;margin-bottom:16px;">
            ${rows}
          </table>

          <table style="width:100%;border-collapse:collapse;">
            ${line("Subtotal", formatCents(o.subtotalCents))}
            ${o.feesCents ? line("Fees", formatCents(o.feesCents)) : ""}
            ${o.taxCents ? line("Tax", formatCents(o.taxCents)) : ""}
            ${o.giftRedeemedCents ? line("Gift card", `− ${formatCents(o.giftRedeemedCents)}`) : ""}
            ${line("Total charged", formatCents(amountCharged), true)}
          </table>

          <p style="margin:20px 0 0;color:#8a887f;font-size:13px;">We'll have your meals ready for your next ${o.fulfillment === "pickup" ? "pickup" : "delivery"}. Questions? Just reply to this email.</p>
        </div>
      </div>
      <p style="text-align:center;color:#b3b0a6;font-size:11px;margin-top:16px;">Powered by PrepFlow</p>
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
