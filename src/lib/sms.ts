// SMS via Twilio's REST API (no SDK: one authenticated POST). Off unless the
// three TWILIO_* env vars are set, so dev and kitchens without it just skip.
//
// Used for cut-off texts to subscribers who opted in at checkout or in their
// account. Every send is counted per kitchen per month against
// BusinessSettings.smsMonthlyCap so a kitchen can't run up a surprise bill.

const SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const FROM = process.env.TWILIO_FROM ?? ""; // E.164 number or Messaging Service SID

export const SMS_ENABLED = Boolean(SID && TOKEN && FROM);

/** Loose North-American normalisation to E.164; null when it can't be a phone number. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return /^\+\d{10,15}$/.test(digits) ? digits : null;
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

/** Send one text. Returns the provider id, or null when disabled or rejected (never throws). */
export async function sendSms(to: string, body: string): Promise<string | null> {
  if (!SMS_ENABLED) return null;
  const e164 = toE164(to);
  if (!e164) return null;
  try {
    const params = new URLSearchParams({ To: e164, Body: body.slice(0, 1000) });
    if (FROM.startsWith("MG")) params.set("MessagingServiceSid", FROM);
    else params.set("From", FROM);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) {
      console.error("[sms] twilio rejected", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { sid?: string };
    return json.sid ?? null;
  } catch (err) {
    console.error("[sms] send failed", err);
    return null;
  }
}

/** The two cut-off texts. Short, no links beyond the account page, kitchen named first. */
export function cutoffSmsBody(input: { businessName: string; deliveryLabel: string; hoursLeft: 48 | 6; accountUrl: string }): string {
  const when = input.hoursLeft === 48 ? "Picks lock in 2 days" : "Last call: picks lock today";
  return `${input.businessName}: ${when} for your ${input.deliveryLabel} delivery. Choose or change your meals: ${input.accountUrl}  Reply STOP to opt out.`;
}
