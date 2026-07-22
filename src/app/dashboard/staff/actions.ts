"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, ROLE_COOKIE } from "@/lib/auth";
import { sendStaffInvite } from "@/lib/email";

export type StaffState = { ok: boolean; message?: string };

const InviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["owner", "staff"]),
});

export async function addStaff(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const { business } = await requireOwner();
  const parsed = InviteInput.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid." };

  const exists = await db.user.findFirst({ where: { businessId: business.id, email: parsed.data.email }, select: { id: true } });
  if (exists) return { ok: false, message: "That email is already on your team." };

  await db.user.create({
    data: {
      businessId: business.id,
      email: parsed.data.email,
      role: parsed.data.role,
      // Placeholder until they sign in — claimed by email on first sign-in (auth.ts).
      authProviderId: `invite:${globalThis.crypto.randomUUID()}`,
    },
  });

  // Invite email so they know to create an account with this address.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await sendStaffInvite({
    to: parsed.data.email,
    businessName: business.name,
    brandColor: business.brandColor,
    role: parsed.data.role,
    signInUrl: `${appUrl}/sign-up`,
  });

  revalidatePath("/dashboard/staff");
  return { ok: true, message: `${parsed.data.email} invited.` };
}

export async function updateStaffRole(formData: FormData) {
  const { business } = await requireOwner();
  const id = String(formData.get("userId"));
  const role = String(formData.get("role"));
  if (role !== "owner" && role !== "staff") return;
  const user = await db.user.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!user) return;
  await db.user.update({ where: { id }, data: { role } });
  revalidatePath("/dashboard/staff");
}

export async function removeStaff(formData: FormData) {
  const { business } = await requireOwner();
  const id = String(formData.get("userId"));
  const user = await db.user.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!user) return;
  await db.user.delete({ where: { id } });
  revalidatePath("/dashboard/staff");
}

/* -------- Demo helpers: preview the staff-restricted view (dev auth) -------- */

export async function previewAsStaff() {
  await requireOwner(); // only an owner can enter the preview
  const store = await cookies();
  store.set(ROLE_COOKIE, "staff", { path: "/", maxAge: 60 * 60 * 8, sameSite: "lax" });
  redirect("/dashboard");
}

export async function exitStaffPreview() {
  const store = await cookies();
  store.set(ROLE_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/dashboard/staff");
}
