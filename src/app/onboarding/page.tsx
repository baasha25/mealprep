import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // Onboarding only applies once Clerk is active; the dev stub has a seeded business.
  if (!process.env.CLERK_SECRET_KEY) redirect("/dashboard");

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await db.user.findUnique({ where: { authProviderId: userId } });
  if (existing) redirect("/dashboard");

  return <OnboardingForm />;
}
