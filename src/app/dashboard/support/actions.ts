"use server";

import { z } from "zod";
import { requireBusiness } from "@/lib/auth";
import { sendSupportRequest } from "@/lib/email";

const SupportInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email so we can reply."),
  subject: z.string().trim().min(3, "Add a short subject.").max(160),
  category: z.string().trim().max(40).optional().default("General"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(5000),
});

export type SupportResult = { ok: boolean; message: string };

/** Send a merchant's help request to PrepFlow support (see sendSupportRequest). */
export async function submitSupportRequest(input: unknown): Promise<SupportResult> {
  const parsed = SupportInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const { business, userName } = await requireBusiness();
  const d = parsed.data;

  const ok = await sendSupportRequest({
    businessId: business.id,
    businessName: business.name,
    fromName: userName || business.name,
    fromEmail: d.email,
    subject: `[${d.category}] ${d.subject}`,
    message: d.message,
  });

  return ok
    ? { ok: true, message: "Thanks — your message is on its way. We'll reply by email." }
    : { ok: false, message: "Couldn't send right now. Please email us directly, or try again." };
}
