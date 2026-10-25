import { Resend } from "resend";

// One Resend client for the app (transactional mail + sending-domain setup).
// Gated on the key so the app runs without it — senders log instead of sending.
const key = process.env.RESEND_API_KEY ?? "";
export const EMAIL_ENABLED = key.startsWith("re_");
export const resend = EMAIL_ENABLED ? new Resend(key) : null;
/** PrepFlow's own sender; kitchens without a verified domain send "via PrepFlow" from here. */
export const PLATFORM_FROM = process.env.EMAIL_FROM || "PrepFlow <onboarding@resend.dev>";

// Domain setup (create / verify / remove sending domains) needs a FULL-ACCESS
// Resend key; the sending key can be restricted. Set RESEND_DOMAINS_API_KEY to a
// full-access key, or leave it unset to try the main key.
const adminKey = process.env.RESEND_DOMAINS_API_KEY || key;
export const resendAdmin = adminKey.startsWith("re_") ? new Resend(adminKey) : null;
