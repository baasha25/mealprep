"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

const Input = z.object({
  name: z.string().trim().min(2, "Enter your kitchen's name").max(80),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color")
    .optional(),
});

export type OnboardResult = { ok: false; message: string };

/**
 * First-run provisioning: a signed-in Clerk user with no kitchen yet creates
 * their Business (with default settings) and becomes its owner. Redirects to
 * the dashboard on success. Idempotent — a user who already has a kitchen is
 * bounced straight to the dashboard.
 */
export async function createKitchen(
  _prev: OnboardResult | null,
  formData: FormData,
): Promise<OnboardResult> {
  const parsed = Input.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brandColor") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Already onboarded → nothing to create.
  const existing = await db.user.findUnique({ where: { authProviderId: userId } });
  if (existing) redirect("/dashboard");

  const cu = await currentUser();
  const email =
    cu?.primaryEmailAddress?.emailAddress ??
    cu?.emailAddresses?.[0]?.emailAddress ??
    "";

  // Ensure a unique storefront slug.
  const base = slugify(parsed.data.name);
  let slug = base;
  let n = 2;
  while (await db.business.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const brandColor = parsed.data.brandColor ?? "#2f4536";
  await db.business.create({
    data: {
      name: parsed.data.name,
      slug,
      brandColor,
      settings: { create: {} }, // all pricing/fulfillment defaults from the schema
      users: { create: { email, role: "owner", authProviderId: userId } },
    },
  });

  // Welcome the new owner (best-effort; never blocks onboarding).
  if (email) {
    const { sendWelcome } = await import("@/lib/email");
    await sendWelcome({ to: email, businessName: parsed.data.name, brandColor });
  }

  redirect("/dashboard");
}
