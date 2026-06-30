"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { dollarsToCents, percentToBps } from "@/lib/money";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Input is the human form (dollars, whole-percent). We convert to cents/bps on save.
const SettingsInput = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Brand color must be a hex value like #2f4536"),
  subDiscount: z.coerce.number().min(0).max(100),
  taxRate: z.coerce.number().min(0).max(100),
  platformFee: z.coerce.number().min(0).max(100),
  deliveryFee: z.coerce.number().min(0).max(1000),
  processingFee: z.coerce.number().min(0).max(1000),
  minOrder: z.coerce.number().min(0).max(100000),
  minMeals: z.coerce.number().int().min(0).max(100),
  cutoff: z.string().trim().max(60),
  fulfillment: z.enum(["delivery", "pickup", "both"]),
  deliveryDays: z.record(z.enum(DAYS), z.boolean()),
  pickupLocations: z.array(z.string().trim().min(1)),
});

export type SettingsActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function updateSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { business } = await requireBusiness();

  const deliveryDays = Object.fromEntries(
    DAYS.map((d) => [d, formData.get(`day_${d}`) === "on"]),
  );
  const pickupLocations = String(formData.get("pickupLocations") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = SettingsInput.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brandColor"),
    subDiscount: formData.get("subDiscount"),
    taxRate: formData.get("taxRate"),
    platformFee: formData.get("platformFee"),
    deliveryFee: formData.get("deliveryFee"),
    processingFee: formData.get("processingFee"),
    minOrder: formData.get("minOrder"),
    minMeals: formData.get("minMeals"),
    cutoff: formData.get("cutoff"),
    fulfillment: formData.get("fulfillment"),
    deliveryDays,
    pickupLocations,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  const d = parsed.data;

  // Business identity + settings updated atomically, scoped to this tenant.
  await db.$transaction([
    db.business.update({
      where: { id: business.id },
      data: { name: d.name, brandColor: d.brandColor },
    }),
    db.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        subDiscountBps: percentToBps(d.subDiscount),
        taxRateBps: percentToBps(d.taxRate),
        platformFeeBps: percentToBps(d.platformFee),
        deliveryFeeCents: dollarsToCents(d.deliveryFee),
        processingFeeCents: dollarsToCents(d.processingFee),
        minOrderCents: dollarsToCents(d.minOrder),
        minMeals: d.minMeals,
        cutoff: d.cutoff,
        fulfillment: d.fulfillment,
        deliveryDays: d.deliveryDays,
        pickupLocations: d.pickupLocations,
      },
      update: {
        subDiscountBps: percentToBps(d.subDiscount),
        taxRateBps: percentToBps(d.taxRate),
        platformFeeBps: percentToBps(d.platformFee),
        deliveryFeeCents: dollarsToCents(d.deliveryFee),
        processingFeeCents: dollarsToCents(d.processingFee),
        minOrderCents: dollarsToCents(d.minOrder),
        minMeals: d.minMeals,
        cutoff: d.cutoff,
        fulfillment: d.fulfillment,
        deliveryDays: d.deliveryDays,
        pickupLocations: d.pickupLocations,
      },
    }),
  ]);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Settings saved." };
}
